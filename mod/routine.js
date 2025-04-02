/**
 * Base class for a playroutine. The playroutine is responsible for advancing
 * through the track and to program the wavetable channels according to the
 * progress of the song.
 */

export class Playroutine {

    /**
     * Create a new instance of the playroutine.
     *
     * @param {object} wavetable
     *      Instance of the wavetable used for audio rendering.
     * @param {object} track
     *      Track as returned by the loadProtrackerMOD() function.
     */

    constructor(wavetable, track) {
        this.track = track
        this.wavetable = wavetable

        this.reset()
    }

    /**
     * Reset the playroutine as if it weren't playing the song before.
     *
     * @abstract
     */

    reset() {}

    /**
     * Return current playroutine preferences.
     *
     * @abstract
     * @returns {object}
     *      Playroutine parameters, see setParameters() for details.
     */

    getParameters() {
        return {}
    }

    /**
     * Set playroutine preferences.
     *
     * @abstract
     * @param {object} [options]
     *      Optional parameters for playback. See setParameters() of the
     *      playroutine implementation for supported options.
     */

    setParameters(options) {}

    /**
     * Return current playroutine and wavetable channel status.
     *
     * @abstract
     * @returns {object}
     *      Object with playroutine and wavetable channel status information.
     */

    getInfo() {
        return {}
    }

    /**
     * Set the sequence position within the track.
     *
     * @abstract
     * @param {number} position
     *      New sequence position. When exceeds song length, the request is
     *      ignored.
     * @param {number} row
     *      New sequence row. When exceeds pattern length, the value is ignored.
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

    setPosition(position, row, options) {}

    /**
     * Process a playroutine tick. This must be called before rendering anything
     * of the song and after rendering samples for the amount of time returned
     * by this function.
     *
     * @abstract
     * @returns {number}
     *      Number of seconds until the next playroutine tick (render the
     *      soundtrack samples for this amount of time, then call
     *      processTick() again).
     */

    processTick() {}
}