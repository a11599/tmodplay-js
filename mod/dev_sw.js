import { RendererDevice } from "./dev.js"
import { SoftwareWavetable } from "./wtbl_sw.js"

/**
 * An audio renderer device using the SoftwareRendererDeviceProcessor
 * AudioWorkletProcessor implementation and SoftwareWavetable to generate audio
 * from a song. The bulk of the operation is implemented in
 * SoftwareRendererDeviceProcessor since it runs in a different thread and
 * needs to have access to the playroutine and the wavetable instance. The
 * renderer's responsibility is to establish the audio context, load the
 * processor and facilitate communication between the Player object and the
 * processor.
 */

export class SoftwareRendererDevice extends RendererDevice {

    /**
     * Interpolation methods supported by the renderer. See
     * SoftwareWavetable.INTERPOLATION for possible options. Default is LINEAR.
     */

    static INTERPOLATION = SoftwareWavetable.INTERPOLATION

    /**
     * Stereo mixing methods supported by the renderer. See
     * SoftwareWavetable.STEREOMODE for possible options. Default is STEREO.
     */

    static STEREOMODE = SoftwareWavetable.STEREOMODE

    /**
     * Create the renderer device.
     *
     * @param {} [sampleRate]
     *      Requested output sample rate. The device may ignore this setting.
     *      Read the value of the sampleRate property after setup() has finished
     *      to get the actual sample rate. If the value is omitted, the device
     *      shall use its default sample rate.
     */

    constructor(sampleRate) {
        super(...arguments)

        this.audioContext = null
        this.audioProcessor = null
        this.leftAnalyzer = null
        this.leftAnalyzerBuffer = null
        this.rightAnalyzer = null
        this.rightAnalyzerBuffer = null
        this.splitter = null
        this.track = null
        this.procResolvers = []
        this.playerInfo = null
        this.parameters = null
    }

    /**
     * Call a method of the AudioWorkletProcessor.
     *
     * @private
     * @param {string} method
     *      Name of the method to call.
     * @param  {...any} args
     *      Parameters passed to the method. Communication happens via
     *      MessageChannel and arguments must be serializable.
     * @returns
     *      Value returned by the processor method.
     */

    async callProcessor(method, ...args) {
        return new Promise((resolve, reject) => {
            const callId = this.procResolvers.push({
                resolve: resolve,
                reject: reject
            }) - 1
            this.audioProcessor.port.postMessage({
                callId: callId,
                method: method,
                args: args
            })
        })
    }

    /**
     * Initialize the renderer. This will initialize the AudioWorkletProcessor
     * and the AudioContext for stereo playback.
     */

    async setup() {

        // Create the audio context and load the processor

        try {
            let audioContext = this.audioContext
            if (!audioContext) {
                audioContext = new AudioContext({
                    sampleRate: this.sampleRate
                })

                await audioContext.resume()
                await audioContext.audioWorklet.addModule("./mod/dev_sw_proc.js")
            }
            this.sampleRate = audioContext.sampleRate

            // Create a looped random noise stereo sample as a dummy input for
            // the processor. There must be some better way for sure, but I just
            // cannot figure it out... Firefox ignores the source and does not
            // provide a stereo outputList for the processor if there is no
            // sample data in the buffer.

            const sourceLength = 100
            const sourceBuffer = audioContext.createBuffer(2, sourceLength, this.sampleRate)
            for (let i = 0; i < sourceBuffer.numberOfChannels; i++) {
                const channel = sourceBuffer.getChannelData(i)
                for (let j = 0; j < channel.length; j++) {
                    channel[j] = Math.random() - .5
                }
            }
            const source = audioContext.createBufferSource()
            source.buffer = sourceBuffer
            source.loop = true

            // Create analyzer and panner nodes for output monitoring

            this.leftAnalyzer = audioContext.createAnalyser()
            this.leftAnalyzer.fftSize = 2048
            this.leftAnalyzerBuffer = new Float32Array(this.leftAnalyzer.fftSize)
            this.rightAnalyzer = audioContext.createAnalyser()
            this.rightAnalyzer.fftSize = this.leftAnalyzer.fftSize
            this.rightAnalyzerBuffer = new Float32Array(this.rightAnalyzer.fftSize)
            this.splitter = new ChannelSplitterNode(audioContext, {
                numberOfOutputs: 2
            })

            // Create the processor and instantiate the audio chain

            this.audioProcessor = new AudioWorkletNode(audioContext, "mod-sw-wavetable-renderer-processor")
            source.connect(this.audioProcessor)
            this.audioProcessor.connect(audioContext.destination)
            this.audioProcessor.connect(this.splitter)
            this.splitter.connect(this.leftAnalyzer, 0)
            this.splitter.connect(this.rightAnalyzer, 1)
            source.start()
            this.audioContext = audioContext
        } catch(e) {
            return
        }

        // Add a listener for audio processor messages

        this.audioProcessor.port.onmessage = ({data}) => {
            if ("callId" in data) {
                if (data.error) {
                    this.procResolvers[data.callId].reject(data.error)
                } else {
                    this.procResolvers[data.callId].resolve(data.result)
                }
                delete this.procResolvers[data.callId]
            } else {
                this.playerInfo = data
            }
        }

        // Initialize the processor and the wavetable

        return this.callProcessor("setup")
    }

    /**
     * Uninitialize the renderer. This closes sound output. setup() must be
     * called to use this renderer instance again.
     */

    async shutdown() {
        this.leftAnalyzer.disconnect()
        this.leftAnalyzer = null
        this.rightAnalyzer.disconnect()
        this.rightAnalyzer = null
        this.splitter.disconnect()
        this.splitter = null
        this.audioProcessor.disconnect()
        this.audioProcessor = null
        this.audioContext.close()
        this.audioContext = null
        this.leftAnalyzerBuffer = null
        this.rightAnalyzerBuffer = null
    }

    /**
     * Load a supported track (song) from a parsed format as returned by for
     * example by the loadProtrackerMOD() function.
     *
     * @param {object} track
     *      Parsed song.
     */

    async loadTrack(track) {

        // If the processor is not yet available, store the track and try to
        // load it directly before playing

        if (this.audioProcessor) {
            this.track = null
            return this.callProcessor("loadTrack", track)
        } else {
            this.track = track
        }
    }

    /**
     * Unload the track (song) from the player.
     */

    async unloadTrack() {
        return this.callProcessor("unloadTrack")
    }

    /**
     * Get the current renderer, wavetable and playroutine parameters.
     *
     * @returns {object}
     *      Current renderer, wavetable and playroutine parameters. See
     *      setParameters() of SoftwareRendererDeviceProcessor,
     *      ProtrackerPlayroutine and SoftwareWavetable for details.
     */

    async getParameters() {
        return this.callProcessor("getParameters")
    }

    /**
     * Set the renderer, wavetable and playroutine parameters.
     *
     * @param {object} options
     *      An object where each key is the name of a parameter and its value is
     *      the value of that parameter. See setParameters() of
     *      SoftwareRendererDeviceProcessor,  ProtrackerPlayroutine and
     *      SoftwareWavetable for supported parameters.
     */

    async setParameters(options) {
        this.parameters = options
        return this.callProcessor("setParameters", options)
    }

    /**
     * Start playback.
     */

    async play() {
        if (this.track) {
            await this.callProcessor("loadTrack", this.track)
            await this.callProcessor("setParameters", this.parameters)
            this.track = null
            this.parameters = null
        }
        this.playerInfo = null
        return this.callProcessor("play")
    }

    /**
     * Stop playback.
     */

    async stop() {
        await this.callProcessor("stop")
        this.playerInfo = null
    }

    /**
     * Return current playroutine and wavetable channel status.
     *
     * @returns {object}
     *      Object with playroutine and wavetable channel status information.
     *      Can be null at the beginning of playback if song is not yet audible
     *      due to audio latency.
     */

    getPlayerInfo() {
        return this.playerInfo
    }

    /**
     * Return 2048 stereo samples of currently played output.
     *
     * @returns {object}
     *      Object with left and right properties, each pointing to a 2048
     *      element Float32Array containing currently played back samples.
     */

    getOutputSamples() {
        this.leftAnalyzer.getFloatTimeDomainData(this.leftAnalyzerBuffer)
        this.rightAnalyzer.getFloatTimeDomainData(this.rightAnalyzerBuffer)

        return {
            left: this.leftAnalyzerBuffer,
            right: this.rightAnalyzerBuffer
        }
    }

    /**
     * Set the sequence position within the track.
     *
     * @param {number} position
     *      New sequence position. When exceeds song length, the request is
     *      ignored.
     * @param {number} row
     *      New sequence row. When exceeds pattern length, the destination
     *      position is advanced forward by one.
     * @param {object} [options]
     *      Positioning options.
     * @param {boolean} [options.stopSamples=false]
     *      Stop samples playing in all channels before adjusting the position.
     * @param {boolean} [options.relativePosition=false]
     *      The amount given in the position argument shall adjust relative to
     *      the currently played position.
     * @param {boolean} [options.relativeRow=false]
     *      The amount given in the row argument shall adjust relative to the
     *      currently played row.
     */

    async setPosition(position, row, options) {
        return this.callProcessor("setPosition", position, row, options)
    }
}