/**
 * Abstract base class for an audio renderer device. Besides outputting audio,
 * the renderer device is also responsible for the coordination of the
 * playroutine and the wavetable.
 */

export class RendererDevice {

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
        this.routine = null

        /**
         * The requested/actual samplerate
         */

        this.sampleRate = sampleRate || undefined
    }

    /**
     * Initialize the renderer. This will bring up the underlying architecture
     * to be able to play a track.
     *
     * @abstract
     */

    async setup() {}

    /**
     * Uninitialize the renderer. This tears down the underlying architecture.
     * setup() must be called to use this renderer instance again.
     *
     * @abstract
     */

    async shutdown() {}

    /**
     * Load a supported track (song) from a parsed format as returned by for
     * example by the loadProtrackerMOD() function.
     *
     * @abstract
     * @param {object} track
     *      Parsed song.
     */

    async loadTrack(track) {}

    /**
     * Unload the track from the renderer.
     *
     * @abstract
     */

    async unloadTrack() {}

    /**
     * Get the current renderer, wavetable and playroutine parameters.
     *
     * @abstract
     * @returns {object}
     *      Current renderer, wavetable and playroutine parameters. See
     *      setParameters() of the selected RendererDevice, Playroutine and
     *      Wavetable object for details.
     */

    async getParameters() {
        return {}
    }

    /**
     * Set the renderer, wavetable and playroutine parameters.
     *
     * @abstract
     * @param {object} options
     *      An object where each key is the name of a parameter and its value is
     *      the value of that parameter. See setParameters() of the selected
     *      RendererDevice, Playroutine and  Wavetable object for supported
     *      parameters.
     */

    async setParameters(options) {}

    /**
     * Start playback.
     *
     * @abstract
     */

    async play() {}

    /**
     * Stop playback.
     *
     * @abstract
     */

    async stop() {}

    /**
     * Return current playroutine and wavetable channel status.
     *
     * @abstract
     * @returns {object}
     *      Object with playroutine and wavetable channel status information.
     *      Can be null at the beginning of playback if song is not yet audible
     *      due to audio latency.
     */

    getPlayerInfo() {
        return null
    }

    /**
     * Return 2048 stereo samples of currently played output.
     *
     * @abstract
     * @returns {object}
     *      Object with left and right properties, each pointing to a 2048
     *      element Float32Array containing currently played back samples.
     */

    getOutputSamples() {
        return null
    }

    /**
     * Set the sequence position within the track.
     *
     * @abstract
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

    async setPosition(position, row, options) {}
}