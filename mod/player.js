import { loadProtrackerMOD } from "../mod/loader_pt.js"

/**
 * MOD player public API.
 */

export class Player {

    /**
     * Internal state of the player.
     */

    static STATE = {

        /**
         * The player has been created but not initialized yet.
         */

        CREATED: 0,

        /**
         * The player is initialized and ready to load a song.
         */

        INITIALIZED: 1,

        /**
         * The song is being played.
         */

        PLAYING: 2
    }

    /**
     * Create the player instance.
     */

    constructor(renderer) {
        this.state = Player.STATE.CREATED
        this.renderer = renderer
        this.trackLoaded = false
    }

    /**
     * Setup the player instance. This must be called before trying to play a
     * song or setting preferences.
     */

    async setup() {
        if (this.state >= Player.STATE.INITIALIZED) {
            return
        }

        await this.renderer.setup()
        this.state = Player.STATE.INITIALIZED
    }

    /**
     * Shutdown the player instance. The player must be reinitialized using the
     * setup() method to use it again.
     */

    async shutdown() {
        if (this.state <= Player.STATE.CREATED) {
            return
        }

        await this.unload()
        await this.renderer.shutdown()
        this.state = Player.STATE.CREATED
    }

    /**
     * Parse a file from a binary buffer.
     *
     * @param {ArrayBuffer} file
     *      A compatible MOD file in an ArrayBuffer.
     * @returns {object}
     *      Parsed song.
     */

    async load(file) {
        await this.unload()

        const track = loadProtrackerMOD(file)
        await this.renderer.loadTrack(track)
        this.trackLoaded = true

        return track
    }

    /**
     * Unload the parsed song from the player.
     */

    async unload() {
        if (!this.trackLoaded) {
            return
        }

        await this.stop()
        await this.renderer.unloadTrack()
        this.trackLoaded = false
    }

    /**
     * Get the current renderer and wavetable parameters.
     *
     * @returns {object}
     *      Current renderer and wavetable parameters. See setParameters() of
     *      the selected RendererDevice and its corresponding Wavetable object
     *      for details.
     */

    async getParameters() {
        if (this.state <= Player.STATE.CREATED) {
            return {}
        }

        return this.renderer.getParameters()
    }

    /**
     * Set the renderer and wavetable parameters.
     *
     * @param {object} options
     *      An object where each key is the name of a parameter and its value is
     *      the value of that parameter. See setParameters() of the selected
     *      RendererDevice and its corresponding Wavetable object for supported
     *      parameters.
     */

    async setParameters(options) {
        if (this.state <= Player.STATE.CREATED) {
            return
        }

        await this.renderer.setParameters(options)
    }

    /**
     * Start playback.
     */

    async play() {
        if (this.state >= Player.STATE.PLAYING) {
            return
        }

        await this.renderer.play()
        this.state = Player.STATE.PLAYING
    }

    /**
     * Stop playback.
     */

    async stop() {
        if (this.state < Player.STATE.PLAYING) {
            return
        }

        await this.renderer.stop()
        this.state = Player.STATE.INITIALIZED
    }

    /**
     * Return current player and channel status.
     *
     * @returns {object}
     *      Object with playroutine and wavetable channel status information.
     *      Can be null at the beginning of playback if song is not yet audible
     *      due to audio latency. Also null if the player is not playing a song.
     */

    getInfo() {
        if (this.state < Player.STATE.PLAYING) {
            return null
        }

        return this.renderer.getPlayerInfo()
    }

    /**
     * Return 2048 stereo samples of currently played output.
     *
     * @returns {object}
     *      Object with left and right properties, each pointing to a 2048
     *      element Float32Array containing currently played back samples. Null
     *      when not currently playing a song.
     */

    getOutputSamples() {
        if (this.state < Player.STATE.PLAYING) {
            return null
        }

        return this.renderer.getOutputSamples()
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
        if (this.state < Player.STATE.PLAYING) {
            return
        }

        return this.renderer.setPosition(position, row, options)
    }
}