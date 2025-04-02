/**
 * Abstract base class for wavetable implementations.
 */

export class Wavetable {

    /**
     * Mixer flags for setMixer() method. Controls which parameters passed to
     * the setMixer() method are applied on the channel.
     */

    static MIXER = {

        /**
         * Set the mixing volume of the channel from the "volume" parameter.
         */

        VOLUME: 0x0001,

        /**
         * Set the channel panning from the "pan" parameter.
         */

        PAN: 0x0002,

        /**
         * Set the mixing sample rate from the "sampleRate" parameter.
         */

        SPEED: 0x0004,

        /**
         * Set the source sample from the "wavetableSample" parameter.
         */

        SAMPLECHANGE: 0x0010,

        /**
         * Set the playback position of the sample from the "samplePositition"
         * parameter.
         */

        SAMPLEPOSITION: 0x0020
    }

    /**
     * Create the wavetable instance. The new instance has no active channels.
     */

    constructor() {}

    /**
     * Set the output sample rate. This must match the sample rate of the output
     * device. This method must be called before attempting any rendering.
     *
     * @abstract
     * @param {number} sampleRate
     *      Output sample rate at which the wavetable will mix the channels.
     */

    setSampleRate(sampleRate) {}

    /**
     * Set the number of channels available for mixing. By default the wavetable
     * has no available channels. Call this method before starting any mixing
     * with the wavetable.
     *
     * @abstract
     * @param {number} numChannels
     *      Number of wavetable channels required for mixing.
     */

    setNumChannels(numChannels) {}

    /**
     * Reset all mixer settings (stop audio output). The configured non-mixer
     * related settings (such as output sample rate, number of channels, samples
     * uploaded, etc.) are preserved.
     *
     * @abstract
     */

    resetMixer() {}

    /**
     * Upload a sample to the wavetable. The wavetable can only mix samples
     * uploaded through this method.
     *
     * @abstract
     * @param {object} instrumentSample
     *      An instrument sample containing a supported sample type and looping
     *      information.
     * @param {object} instrumentSample.audioSample
     *      An ArrayBufferView of the sample using a supported sample format.
     *      Wavetable implementations should support at least 8/16 bit signed
     *      and unsigned samples in Int8Array,  Uint8Array, Int16Array and
     *      Uint16Array buffers.
     * @param {number} instrumentSample.loopStart
     *      Start of the looping point within the sample data.
     * @param {number} instrumentSample.loopLength
     *      Length of the looped area within the sample data. Set to 0 to
     *      disable looping.
     * @returns {number}
     *      A numeric identifier that must be passed to the setMixer() method
     *      in the "wavetableSample" parameter for picking this sample for
     *      playback.
     */

    uploadSample(instrumentSample) {
        return null
    }

    /**
     * Remove a previously uploaded sample from the wavetable.
     *
     * @abstract
     * @param {number} wavetableSample
     *      Identifier of the sample as returned by uploadSample().
     */

    removeSample(wavetableSample) {}

    /**
     * Return current wavetable parameters. See setParameters() for details.
     *
     * @abstract
     * @returns {object}
     */

    getParameters() {
        return {}
    }

    /**
     * Set wavetable parameters.
     *
     * @abstract
     * @param {object} [options]
     *      An object where each key is the name of a parameter and its value is
     *      the value of that parameter. For supported parameters refer to the
     *      actual wavetable subclass.
     */

    setParameters(options) {}

    /**
     * Set mixer parameters for a wavetable channel.
     *
     * @abstract
     * @param {number} channelNr
     *      Channel number (starting at 0) for which the parameters are set. If
     *      the channel is not available (because the number is larger, than
     *      the number of channels specified in setNumChannels()), the request
     *      is ignored.
     * @param {number} mixerFlags
     *      Parameters of the channel that need to be changed. Combine
     *      Wavetable.MIXER constants with the bitwise OR operator (|) to set
     *      multiple parameters at once.
     * @param {object} params
     *      Mixer parameters.
     * @param {number} [params.volume]
     *      Volume of the channel between 0 - 1. Set Wavetable.MIXER.VOLUME in
     *      mixerFlags.
     * @param {number} [params.pan]
     *      Stereo panning of the channel between -1 (left) and 1 (right). Set
     *      Wavetable.MIXER.PAN in mixerFlags.
     * @param {number} [params.sampleRate]
     *      Mixing sample rate. Set to 0 to halt playback at the current sample.
     *      Set Wavetable.MIXER.SPEED in mixerFlags.
     * @param {number} [params.wavetableSample]
     *      Identifier of the sample as returned by uploadSample() to be used
     *      for mixing. Set Wavetable.MIXER.SAMPLECHANGE in mixerFlags.
     * @param {number} [params.samplePosition]
     *      0-based position of the sample from where the mixing will start. It
     *      is an index and does not depend on the actual memory allocation size
     *      of the sample (ie. to start mixing from the 100th sample, use the
     *      same value (99) for 8 and 16 bit samples). Set
     *      Wavetable.MIXER.SAMPLEPOSITION in mixerFlags.
     */

    setMixer(channelNr, mixerFlags, params) {}

    /**
     * Render audio into a stereo floating point output target buffer.
     *
     * @abstract
     * @param {Float32Array[]} targetBuffer
     *      A pair of floating point target buffers, where the first buffer
     *      represents the left channel and the second buffer represents the
     *      right channel. The two buffers must have the same length.
     * @param {number} offset
     *      Starting offset (sample) in the buffer where the render will start.
     * @param {number} numSamples
     *      Number of samples to render into the target buffers.
     */

    render(targetBuffer, offset, numSamples) {}

    /**
     * Return information about wavetable channels.
     *
     * @abstract
     * @returns {object[]}
     *      Array of objects with status for each channel.
     */

    getMixerInfo() {
        return []
    }
}

/**
 * Get the pan range between for a channel number as it was panned on the Amiga.
 *
 * @param {number} channelNr
 *      Channel number starting at 0.
 * @returns {number}
 *      Amiga panning between -1 (full left) and 1 (full right).
 */

export function amigaChannelPan(channelNr) {
    return [-1, 1, 1, -1][channelNr % 4]
}