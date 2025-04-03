import { ProtrackerPlayroutine } from "./routine_pt.js"
import { SoftwareWavetable } from "./wtbl_sw.js"

/**
 * An AudioWorkletProcessor for SoftwareRendererDevice using SoftwareWavetable.
 */

class SoftwareRendererDeviceProcessor extends AudioWorkletProcessor {

    /**
     * State of the processor.
     */

    static STATE = {

        /**
         * The audio output from the processor is stopped.
         */

        STOPPED: 0,

        /**
         * Start of playback was requested.
         */

        STARTING: 1,

        /**
         * The song is being played.
         */

        PLAYING: 2,

        /**
         * Stop of playback was requested.
         */

        STOPPING: 3
    }

    /**
     * Create the processor.
     */

    constructor() {
        super(...arguments)

        this.state = SoftwareRendererDeviceProcessor.STATE.STOPPED
        this.resolveStart = null
        this.resolveStop = null
        this.startTime = 0
        this.wavetableSamples = []

        /**
         * The SoftwareWavetable instance used to render the audio.
         */

        this.wavetable = new SoftwareWavetable()

        /**
         * Number of samples left to render until the next playroutine tick.
         */

        this.tickSamplesLeft = 0

        // Install proxy handler for method calling from SoftwareRendererDevice

        this.port.onmessage = ({data}) => {

            // Invalid method name, return error

            if (typeof this[data.method] !== "function") {
                this.port.postMessage({
                    callId: data.callId,
                    error: new Error(`Method "${data.method}" is not supported.`)
                })
                return
            }

            // Attempt to invoke the method and return its result

            try {
                const result = this[data.method].apply(this, data.args)

                if (result instanceof Promise) {

                    // Async method, return with the resolved result or error

                    result.then(result => {
                        this.port.postMessage({
                            callId: data.callId,
                            result: result
                        })
                    }).catch(e => {
                        this.port.postMessage({
                            callId: data.callId,
                            error: e
                        })
                    })
                } else {

                    // Synchronous method, return with the result

                    this.port.postMessage({
                        callId: data.callId,
                        result: result
                    })
                }
            } catch(e) {

                // Method failed, return the error

                this.port.postMessage({
                    error: e
                })
            }
        }
    }

    /**
     * Setup the processor for playback.
     */

    setup() {
        this.wavetable.setSampleRate(sampleRate)
    }

    /**
     * Load a supported track (song) from a parsed format as returned by for
     * example by the loadProtrackerMOD() function.
     *
     * @param {object} track
     *      Parsed song.
     */

    loadTrack(track) {

        // Initialize playroutine

        switch (track.type) {
            case "MOD":
                this.routine = new ProtrackerPlayroutine(this.wavetable, track)
                break

            default:
                throw new Error(`Unsupported module type: "${track.type}"`)
        }

        // Initialize wavetable

        this.wavetable.setNumChannels(track.numChannels)
        track.samples.forEach(sample => {
            sample.wavetableSample = this.wavetable.uploadSample(sample)
            this.wavetableSamples.push(sample.wavetableSample)
        })
    }

    /**
     * Unload the parsed song from the player.
     */

    unloadTrack() {
        this.wavetableSamples.forEach((wavetableSample, i) => {
            this.wavetable.removeSample(wavetableSample)
        })
        this.wavetableSamples.length = 0
    }

    /**
     * Get the current wavetable and playroutine parameters.
     *
     * @returns {object}
     *      Current wavetable and playroutine parameters. See setParameters()
     *      of ProtrackerPlayroutine and SoftwareWavetable for details.
     */

    getParameters() {
        let options = this.routine ? this.routine.getParameters() : {}
        Object.assign(options, this.wavetable.getParameters())

        return options
    }

    /**
     * Set the wavetable and playroutine parameters.
     *
     * @param {object} options
     *      An object where each key is the name of a parameter and its value is
     *      the value of that parameter. See setParameters() of
     *      ProtrackerPlayroutine and SoftwareWavetable for supported
     *      parameters.
     */

    setParameters(options) {
        options = options || {}

        if (this.routine) {
            this.routine.setParameters(options)
        }
        this.wavetable.setParameters(options)
    }

    /**
     * Start playback.
     */

    async play() {
        return new Promise(resolve => {
            this.resolveStart = resolve
            this.routine.reset()
            this.wavetable.resetMixer()
            this.state = SoftwareRendererDeviceProcessor.STATE.STARTING
        })
    }

    /**
     * Stop playback.
     */

    async stop() {
        return new Promise(resolve => {
            this.resolveStop = resolve
            this.state = SoftwareRendererDeviceProcessor.STATE.STOPPING
        })
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
        return this.routine.setPosition(position, row, options)
    }

    /**
     * Render samples to the audio context's output buffer.
     *
     * @param inputList
     *      Array of inputs connected to the processor. It is ignored and the
     *      inputs are overwritten.
     * @param {Float32Array[][]} outputList
     *      Array of outputs connected to the processor. The processor renders
     *      into the first output and expects two Float32Arrays as the first
     *      output (stereo sound).
     * @returns {boolean}
     *      Always true.
     */

    process(inputList, outputList) {
        try {

            // Don't render when stopped or no playroutine

            if (!this.routine || this.state === SoftwareRendererDeviceProcessor.STATE.STOPPED) {
                return true
            }

            // Handle playback start/stop requests

            if (this.state === SoftwareRendererDeviceProcessor.STATE.STARTING) {
                this.state = SoftwareRendererDeviceProcessor.STATE.PLAYING
                this.startTime = currentTime
                if (typeof this.resolveStart === "function") {
                    const started = this.resolveStart
                    this.resolveStart = null
                    started()
                }
            } else if (this.state === SoftwareRendererDeviceProcessor.STATE.STOPPING) {
                this.state = SoftwareRendererDeviceProcessor.STATE.STOPPED
                if (typeof this.resolveStop === "function") {
                    const stopped = this.resolveStop
                    this.resolveStop = null
                    this.routine.reset()
                    this.wavetable.resetMixer()
                    stopped()
                }
            }

            // Playing, render stereo audio into output buffer

            let buffer = outputList[0]
            let bufferOffset = 0
            let bufferLength = buffer[0].length

            while (bufferLength > 0) {

                // Call the periodic playroutine tick

                if (this.tickSamplesLeft < 1) {
                    this.tickSamplesLeft += this.routine.processTick() * sampleRate
                }

                // Render samples until next tick or end of render buffer

                let renderLength = Math.min(bufferLength, Math.round(this.tickSamplesLeft))
                this.wavetable.render(buffer, bufferOffset, renderLength)

                this.tickSamplesLeft -= renderLength
                bufferLength -= renderLength
                bufferOffset += renderLength
            }

            // Post player and wavetable channel info to the renderer process.

            this.port.postMessage({
                timestamp: currentTime,
                playTimestamp: currentTime - this.startTime,
                status: this.routine.getInfo()
            })
        } catch(e) {
            console.error(e)
        }

        return true
    }
}

// Register the processor module

registerProcessor("mod-sw-wavetable-renderer-processor", SoftwareRendererDeviceProcessor)