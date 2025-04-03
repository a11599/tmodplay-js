import { amigaChannelPan, Wavetable } from "./wtbl.js"

/**
 * Number of samples unrolled before the start of each sample. Watte
 * interpolation requires one, the rest don't need any.
 */

const preRoll = 1

/**
 * Number of samples unrolled after the end of the loop of each sample. Watte
 * interpolation requires two, linear requires one additional sample.
 */

const postRoll = 2

/**
 * Length of volume ramp in milliseconds for a full-scale volume swing. Actual
 * ramping time is usually much lower, depending on the volume difference to be
 * applied. Volume ramping is used with linear and Watte interpolations to
 * reduce clicking caused by sudden large volume changes and changes of the
 * sample associated with a channel without letting the original sample play
 * to its end. Volume ramping is not applied for nearest neighbor and BLEP
 * interpolations, the aliasing noise pretty much masks the issue and these
 * clicks are just part of the overall experience of the rawness.
 */

const volumeRampTime = 10

/**
 * Limit a numeric value to a given range.
 *
 * @param {number} value
 *      Value to limit.
 * @param {number} min
 *      Minimum value.
 * @param {number} max
 *      Maximum value.
 * @returns {number}
 *      Original value if within limits, otherwise minimum or maximum value
 *      when the limits are exceeded.
 */

function clamp(value, min, max) {
    if (value < min) {
        return min
    } else if (value > max) {
        return max
    }
    return value
}

/**
 * A simple wavetable implemented in software.
 */

export class SoftwareWavetable extends Wavetable {

    /**
     * Sample upsampling interpolation methods supported by the wavetable.
     * Default is LINEAR.
     */

    static INTERPOLATION = {

        /**
         * Nearest neighbor or zero-order hold upsampling. No interpolation is
         * applied, the nearest sample (in the time domain) is mixed to the
         * output. Produces horrible aliasing which sounds relatively close to
         * the output of the Amiga. Many early MODs rely on the existence of
         * the aliasing for treble enhancement and will sound dull when a better
         * quality interpolation method is used.
         */

        NEAREST: 0,

        /**
         * Band-limited step interpolation (BLEP) from pt2-clone. It sounds very
         * close to a real Amiga, but is computationally a lot more expensive
         * than anything else here.
         */

        BLEP: 1,

        /**
         * Linear interpolation. Generates in-between samples using a weighted
         * average algorithm. The interpolation operates on floating point
         * sample values and produces a relatively noise free output even with
         * 8-bit samples. The output is similar to that of the Gravis Ultrasound
         * which was used by many PC composers of the era.
         */

        LINEAR: 2,

        /**
         * Trilinear interpolation by Jon Watte, as published in Olli
         * Niemitalo's paper "Polynomial Interpolators for High-Quality
         * Resampling of Oversampled Audio" (deip.pdf). Excellent sound quality,
         * but MODs using low quality samples will sound extremely dull.
         */

        WATTE: 3
    }

    /**
     * Stereo mixing modes supported by the wavetable. Default is STEREO.
     */

    static STEREOMODE = {

        /**
         * Output the mix in mono (everything mixed to center).
         */

        MONO: 0,

        /**
         * Output the mix to the side channels as mapped by the Amiga hardware.
         * Channels 1 and 4 are mixed to the left, channels 2 and 3 are mixed
         * to the right channel. This aligment repeats for subsequent channels
         * when more than 4 are utilized. Channel pan is ignored in this mode.
         * The "amigaCrossfeed" parameter can be used to cross-feed the output
         * for a narrower and more pleasant sound stage. See setParameters() for
         * details.
         */

        AMIGA: 1,

        /**
         * Output the mix as stereo based on each channel's panning.
         */

        STEREO: 2
    }

    /**
     * Create the wavetable instance. The new instance has no active channels.
     */

    constructor() {
        super()

        this.blep = new BLEPResampler()
        this.channels = []
        this.sampleId = 0
        this.samples = {}
        this.stereoMode = SoftwareWavetable.STEREOMODE.STEREO
        this.interpolation = SoftwareWavetable.INTERPOLATION.LINEAR
        this.amigaCrossfeed = 0
        this.amplification = 1.0
        this.sampleRate = 0
        this.volumeRampStep = 1
    }

    /**
     * Set the output sample rate. This must match the sample rate of the output
     * device. This method must be called before attempting any rendering.
     *
     * @param {number} sampleRate
     *      Output sample rate at which the wavetable will mix the channels.
     */

    setSampleRate(sampleRate) {
        this.sampleRate = sampleRate
        this.volumeRampStep = 1 / (this.sampleRate / 1000 * volumeRampTime)
    }

    /**
     * Set the number of channels available for mixing. By default the wavetable
     * has no available channels. Call this method before starting any mixing
     * with the wavetable.
     *
     * @param {number} numChannels
     *      Number of wavetable channels required for mixing.
     */

    setNumChannels(numChannels) {
        this.blep.setNumChannels(numChannels)

        let i = this.channels.length
        this.channels.length = numChannels

        while (i < numChannels) {
            this.resetChannel(i)
            i++
        }
   }

    /**
     * Reset all mixer settings (stop audio output). The configured non-mixer
     * related settings (such as output sample rate, number of channels, samples
     * uploaded, etc.) are preserved.
     */

    resetMixer() {
        for (let i = 0; i < this.channels.length; i++) {
            this.resetChannel(i)
        }
    }

    /**
     * Reset a single channel of the wavetable.
     *
     * @private
     * @param {number} channelNr
     *      Index of the channel.
     */

    resetChannel(channelNr) {
        this.blep.resetChannel(channelNr)

        if (channelNr >= this.channels.length) {
            return
        }

        this.channels[channelNr] = {
            sample: null,               // Wavetable sample object
            samplePosition: 0,          // Sample position
            sampleRate: 0,              // Playback samplerate
            speed: 0,                   // Playback speed
            volume: 0,                  // Mono volume (0 - 1)
            leftVolume: 0,              // Left channel volume (0 - 1)
            rightVolume: 0,             // Right channel volume (0 - 1)
            targetVolume: 0,            // Target mono volume for ramping
            leftTargetVolume: 0,        // Target left volume for ramping
            rightTargetVolume: 0,       // Target right volume for ramping
            volumeStep: 0,              // Target mono volume step for ramping
            leftVolumeStep: 0,          // Target left volume step for ramping
            rightVolumeStep: 0,         // Target right volume step for ramping
            volumeRampSteps: 0,         // Number of volume steps for ramping
            pan: 0,                     // Panning (-1 - 1)
            ampVolume: 0,               // Amplified mono volume (0 - 1)
            leftPanGain: 0,             // Left channel panning gain (0 - 1)
            rightPanGain: 0,            // Right channel panning gain (0 - 1)
            cutoff: {                   // On a sample change, the previous
                sample: null,           // sample is played for a short time
                samplePosition: 0,      // with the volume smoothly ramping off
                sampleRate: 0,          // to eliminate clicking.
                speed: 0,
                volume: 0,
                leftVolume: 0,
                rightVolume: 0,
                volumeStep: 0,
                leftVolumeStep: 0,
                rightVolumeStep: 0,
                volumeRampSteps: 0
            }
        }
    }

    /**
     * Upload a sample to the wavetable. The wavetable can only mix samples
     * uploaded through this method.
     *
     * @param {object} instrumentSample
     *      An instrument sample containing a supported sample type and looping
     *      information.
     * @param {object} instrumentSample.audioSample
     *      An ArrayBufferView of the sample using a supported sample format.
     *      Supported formats are 8/16 bit signed and unsigned samples in
     *      Int8Array,  Uint8Array, Int16Array and Uint16Array buffers.
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
        if (!instrumentSample.audioSample) {
            return -1
        }

        // Initialize sample properties

        let loopStart = instrumentSample.loopStart
        let length = instrumentSample.loopLength > 0 ? loopStart + instrumentSample.loopLength : instrumentSample.audioSample.length
        const audioSample = instrumentSample.audioSample
        const sample = new Float32Array(length + preRoll + postRoll)

        const wavetableSample = {
            data: sample,
            start: preRoll,
            loopStart: instrumentSample.loopLength > 0 ? instrumentSample.loopStart + preRoll : 0,
            loopLength: instrumentSample.loopLength,
            length: length + preRoll
        }

        // Copy 8/16 bit integer sample to internal Float32Array buffer

        length += preRoll
        if (audioSample instanceof Int8Array) {
            for (let i = preRoll, j = 0; i < length; i++, j++) {
                sample[i] = audioSample[j] / 128
            }
        } else if (audioSample instanceof Uint8Array) {
            for (let i = preRoll, j = 0; i < length; i++, j++) {
                sample[i] = (audioSample[j] - 128) / 128
            }
        } else if (audioSample instanceof Int16Array) {
            for (let i = preRoll, j = 0; i < length; i++, j++) {
                sample[i] = audioSample[j] / 32768
            }
        } else if (audioSample instanceof Uint16Array) {
            for (let i = preRoll, j = 0; i < length; i++, j++) {
                sample[i] = (audioSample[j] - 32768) / 32768
            }
        } else {
            throw new Error("Unsupported sample data format")
        }

        // Unroll a few samples of the loop for looped sample interpolation

        if (loopStart > 0) {
            loopStart += preRoll
            for (let i = 0, j = length, k = loopStart; i < postRoll; i++, j++, k++) {
                if (k >= length) {
                    k = loopStart
                }
                sample[j] = sample[k]
            }
        }

        this.sampleId++
        this.samples[this.sampleId] = wavetableSample
        return this.sampleId
    }

    /**
     * Remove a previously uploaded sample from the wavetable.
     *
     * @param {number} wavetableSample
     *      Identifier of the sample as returned by uploadSample().
     */

    removeSample(wavetableSample) {
        delete this.samples[wavetableSample]
    }

    /**
     * Return current wavetable parameters. See setParameters() for details.
     *
     * @returns {object}
     */

    getParameters() {
        return {
            amigaCrossfeed: this.amigaCrossfeed,
            amplification: this.amplification,
            interpolation: this.interpolation,
            stereoMode: this.stereoMode
        }
    }

    /**
     * Set wavetable parameters.
     *
     * @param {object} [options]
     *      An object where each key is the name of a parameter and its value is
     *      the value of that parameter.
     * @param {number} [options.amigaCrossfeed=0]
     *      Amount of channel crossfeed between left and right channels when
     *      SoftwareWavetable.STEREOMODE.AMIGA is used for stereo output. The
     *      accepted value is in the range of 0 - 1 where 0 is full stereo
     *      (no crossfeed) and 1 is full mono (100% crossfeed). Recommended
     *      value is around 0.75 for non-stereo aware songs for best experience.
     * @param {number} [options.amplification=1.0]
     *      Amount of gain applied after mixing. The gain is linear. Supported
     *      values are between 0 and 4. An amplification of 1 can in theory
     *      result in clipping with just 4 channels if all channels are panned
     *      to the same extreme of the stereo field. In practice the default
     *      amplification of 1.0 should not cause clipping with most songs, even
     *      multichannel ones.
     * @param {number} [options.interpolation]
     *      A supported interpolation method from one of the
     *      SoftwareWavetable.INTERPOLATION constants. Unsupported values are
     *      ignored.
     * @param {number} [options.stereoMode]
     *      A supported stereo rendering method from one of the
     *      SoftwareWavetable.STEREOMODE constants. Unsupported values are
     *      ignored.
     */

    setParameters(options) {
        options = options || {}
        let applyVolume = false

        if ("amigaCrossfeed" in options) {
            this.amigaCrossfeed = clamp(options.amigaCrossfeed, 0, 1)
            applyVolume = true
        }

        if ("amplification" in options) {
            this.amplification = clamp(options.amplification, 0, 4)
            applyVolume = true
        }

        if ("interpolation" in options && Object.values(SoftwareWavetable.INTERPOLATION).indexOf(options.interpolation) >= 0) {
            this.interpolation = options.interpolation
        }

        if ("stereoMode" in options && Object.values(SoftwareWavetable.STEREOMODE).indexOf(options.stereoMode) >= 0) {
            this.stereoMode = options.stereoMode
            applyVolume = true
        }

        if (applyVolume) {
            this.channels.forEach((channel, channelNr) =>
                this.applyVolume(channelNr, channel.volumeRampSteps ? channel.targetVolume : channel.volume)
            )
        }
    }

    /**
     * Apply a volume to a specific channel.
     *
     * @private
     * @param {number} channelNr
     *      Index of the channel.
     * @param {number} volume
     *      Wanted volume of the channel between 0 - 1.
     * @param {boolean} [disableRamping=false]
     *      When true, volume ramping is disabled.
     */

    applyVolume(channelNr, volume, disableRamping) {
        const channel = this.channels[channelNr]
        const amplificationDivisor = 4

        // Set pan based on stereo mode and channel pan

        let pan = channel.pan
        if (this.stereoMode === SoftwareWavetable.STEREOMODE.MONO) {
            pan = 0
        } else if (this.stereoMode === SoftwareWavetable.STEREOMODE.AMIGA) {
            pan = amigaChannelPan(channelNr) * (1 - this.amigaCrossfeed)
        }

        // Set volume, use volume ramping for linear and Watte interpolations to
        // reduce clicks

        channel.ampVolume = volume * (this.amplification / amplificationDivisor)
        channel.leftPanGain = Math.sqrt((1 - pan) / 2)
        channel.rightPanGain = Math.sqrt((1 + pan) / 2)
        channel.targetVolume = volume
        channel.leftTargetVolume = channel.leftPanGain * channel.ampVolume
        channel.rightTargetVolume = channel.rightPanGain * channel.ampVolume
        const volDiff = Math.max(
            Math.abs(channel.leftTargetVolume - channel.leftVolume),
            Math.abs(channel.rightTargetVolume - channel.rightVolume)
        )
        channel.volumeRampSteps = Math.floor(volDiff / this.volumeRampStep)

        if (disableRamping || channel.volumeRampSteps <= 0 ||
            this.interpolation === SoftwareWavetable.INTERPOLATION.NEAREST ||
            this.interpolation === SoftwareWavetable.INTERPOLATION.BLEP
        ) {
            channel.volumeRampSteps = 0
            channel.volume = channel.targetVolume
            channel.leftVolume = channel.leftTargetVolume
            channel.rightVolume = channel.rightTargetVolume
        } else {
            channel.volumeStep = (channel.targetVolume - channel.volume) / channel.volumeRampSteps
            channel.leftVolumeStep = (channel.leftTargetVolume - channel.leftVolume) / channel.volumeRampSteps
            channel.rightVolumeStep = (channel.rightTargetVolume - channel.rightVolume) / channel.volumeRampSteps
        }
    }

    /**
     * Set mixer parameters for a wavetable channel.
     *
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

    setMixer(channelNr, mixerFlags, params) {
        if (channelNr >= this.channels.length) {
            return
        }

        const channel = this.channels[channelNr]
        let volume = channel.volumeRampSteps ? channel.targetVolume : channel.volume
        let applyVolume = false
        let disableRamping = false
        let cutoffDone = false

        if (mixerFlags & Wavetable.MIXER.VOLUME) {
            volume = clamp(params.volume, 0, 1)
            applyVolume = true
        }

        if (mixerFlags & Wavetable.MIXER.PAN) {
            channel.pan = clamp(params.pan, -1, 1)
            applyVolume = true
        }

        if (mixerFlags & Wavetable.MIXER.SPEED) {
            if (params.sampleRate > 0) {
                channel.sampleRate = params.sampleRate
                channel.speed = params.sampleRate / this.sampleRate
            } else {
                channel.sampleRate = 0
                channel.speed = 0
            }
            this.blep.setSpeed(channelNr, channel.speed)
        }

        // Determine new sample and position

        let newSample = channel.sample
        let newSamplePosition = channel.samplePosition
        if (mixerFlags & Wavetable.MIXER.SAMPLEPOSITION) {
            newSamplePosition = params.samplePosition >= 0 ? params.samplePosition : 0
        }
        if (mixerFlags & Wavetable.MIXER.SAMPLECHANGE) {
            newSample = this.samples[params.wavetableSample] || null
        }

        // Apply new position when changed

        if ((mixerFlags & Wavetable.MIXER.SAMPLEPOSITION) && newSamplePosition !== channel.samplePosition) {

            // Cutoff previous sample

            this.cutoffSample(channel)
            cutoffDone = true

            // Use new position, disable volume ramping when 0, otherwise force

            channel.samplePosition = newSamplePosition
            if (newSamplePosition === 0) {
                disableRamping = true
            } else {
                channel.volume = 0
                channel.leftVolume = 0
                channel.rightVolume = 0
                applyVolume = true
            }
        }

        // Apply new sample when changed

        if ((mixerFlags & Wavetable.MIXER.SAMPLECHANGE) && newSample !== channel.sample) {

            // Cutoff previous sample (unless already done by SAMPLECHANGE)

            if (!cutoffDone) {
                this.cutoffSample(channel)
            }

            // Use new sample, disable volume ramping when playing from start

            channel.sample = newSample
            if (newSamplePosition === 0) {
                disableRamping = true
            }
        }

        // Apply volume

        if (applyVolume) {
            this.applyVolume(channelNr, volume, disableRamping)
        }
    }

    /**
     * Cut off the end of a sample in a channel by marking it for playback with
     * volume ramped towards 0 and current interpolation is not nearest
     * neighbor.
     *
     * @param {object} channel
     *      Wavetable channel object.
     */

    cutoffSample(channel) {
        if (
            this.interpolation === SoftwareWavetable.INTERPOLATION.NEAREST ||
            this.interpolation === SoftwareWavetable.INTERPOLATION.BLEP
        ) {
            channel.cutoff.volumeRampSteps = 0
            return
        }

        // Copy relevant channel parameters

        Object.keys(channel.cutoff).forEach(key => {
            channel.cutoff[key] = channel[key]
        })

        // Set ramping parameters

        const volDiff = Math.max(channel.cutoff.leftVolume, channel.cutoff.rightVolume)
        channel.cutoff.volumeRampSteps = Math.floor(volDiff / this.volumeRampStep)
        if (channel.cutoff.volumeRampSteps > 0) {
            channel.cutoff.volumeStep = (-channel.cutoff.volume) / channel.cutoff.volumeRampSteps
            channel.cutoff.leftVolumeStep = (-channel.cutoff.leftVolume) / channel.cutoff.volumeRampSteps
            channel.cutoff.rightVolumeStep = (-channel.cutoff.rightVolume) / channel.cutoff.volumeRampSteps
        } else {
            channel.cutoff.volumeRampSteps = 0
        }
    }

    /**
     * Render audio into a stereo floating point output target buffer.
     *
     * @param {Float32Array[]} targetBuffer
     *      A pair of floating point target buffers, where the first buffer
     *      represents the left channel and the second buffer represents the
     *      right channel. The two buffers must have the same length.
     * @param {number} offset
     *      Starting offset (sample) in the buffer where the render will start.
     * @param {number} numSamples
     *      Number of samples to render into the target buffers.
     */

    render(targetBuffer, offset, numSamples) {
        const interpolation = this.interpolation
        const blep = this.blep

        this.channels.forEach((channel, channelNr) => {
            let sample
            let sampleLength
            let sampleLoopLength
            let sampleData
            let samplePosition
            let volRampLength = 0

            // Cut off (fade out) previous sample

            if (channel.cutoff && channel.cutoff.sample) {
                volRampLength = Math.min(channel.cutoff.volumeRampSteps, numSamples)

                if (volRampLength > 0) {
                    sample = channel.cutoff.sample
                    sampleLength = sample.length
                    sampleLoopLength = sample.loopLength
                    sampleData = sample.data
                    samplePosition = channel.cutoff.samplePosition + sample.start

                    renderChunk(
                        channel.cutoff, offset, offset + volRampLength,
                        channel.cutoff.volumeStep, channel.cutoff.leftVolumeStep, channel.cutoff.rightVolumeStep
                    )

                    channel.cutoff.volumeRampSteps -= volRampLength
                    channel.cutoff.samplePosition = samplePosition - sample.start
                }

                // Cutoff complete, remove sample reference

                if (channel.cutoff.volumeRampSteps === 0) {
                    channel.cutoff.sample = null
                }
            }

            // Mix current sample

            sample = channel.sample
            if (sample === null) {
                return
            }

            sampleLength = sample.length
            sampleLoopLength = sample.loopLength
            sampleData = sample.data
            samplePosition = channel.samplePosition + sample.start

            let chunkOffset = offset
            let chunkLength = numSamples

            // Render while ramping volume slowly to avoid audible clicks due
            // to sudden change of DAC output

            volRampLength = Math.min(channel.volumeRampSteps, numSamples)
            if (volRampLength > 0) {
                renderChunk(
                    channel, offset, offset + volRampLength,
                    channel.volumeStep, channel.leftVolumeStep, channel.rightVolumeStep
                )

                chunkOffset += volRampLength
                chunkLength -= volRampLength
                channel.volumeRampSteps -= volRampLength

                // Volume ramping complete, set wanted volume levels for further
                // mixing

                if (channel.volumeRampSteps === 0) {
                    channel.volume = channel.targetVolume
                    channel.leftVolume = channel.leftTargetVolume
                    channel.rightVolume = channel.rightTargetVolume
                }
            }

            // Render the rest of the output at full wanted volume. When
            // volume is 0, rendering is not necessary, just skip forward in
            // sample position.

            if (chunkLength > 0) {
                if (channel.volume === 0) {
                    samplePosition += chunkLength * channel.speed
                    if (samplePosition > sampleLength && sampleLoopLength > 0) {
                        samplePosition = ((samplePosition - sample.loopStart) % sampleLoopLength) + sample.loopStart
                    }
                } else {
                    renderChunk(channel, chunkOffset, chunkOffset + chunkLength)
                }
            }

            // Save final sample position

            channel.samplePosition = samplePosition - sample.start

            /**
             * Render a chunk of audio into the target buffer, using optional
             * volume ramping.
             *
             * @param {object} channel
             *      Wavetable channel object.
             * @param {number} chunkStart
             *      Start offset into target buffer.
             * @param {number} chunkEnd
             *      End offset into target buffer. Audio will be rendered up to,
             *      but not including this buffer index.
             * @param {number} [volumeStep=0]
             *      Optional step value for ramping of channel.volume.
             * @param {number} [leftVolumeStep=0]
             *      Optional step value for ramping of channel.leftVolume.
             * @param {number} [rightVolumeStep=0]
             *      Optional step value for ramping of channel.rightVolumeStep.
             */

            function renderChunk(channel, chunkStart, chunkEnd, volumeStep, leftVolumeStep, rightVolumeStep) {
                volumeStep = volumeStep || 0
                leftVolumeStep = leftVolumeStep || 0
                rightVolumeStep = rightVolumeStep || 0

                // Bringing the switch-case out of the loop does not bring much
                // performance benefit (if any), so leave it inside for the sake
                // of code size/readability

                for (let i = chunkStart; i < chunkEnd; i++) {

                    // Ramp the volume

                    channel.volume += volumeStep
                    channel.leftVolume += leftVolumeStep
                    channel.rightVolume += rightVolumeStep

                    // Wrap back when loop end point exceeded. The do - while
                    // is used because in theory we might step over the loop
                    // multiple times with low output sample rates and high
                    // mixing sample rates, although the practical chance for
                    // this is pretty much zero.

                    if (samplePosition > sampleLength) {
                        if (sampleLoopLength === 0) {
                            return
                        } else {
                            samplePosition = ((samplePosition - sample.loopStart) % sampleLoopLength) + sample.loopStart
                        }
                    }

                    // Calculate output sample based on interpolation method

                    const pos = Math.floor(samplePosition)
                    switch (interpolation) {
                        case SoftwareWavetable.INTERPOLATION.NEAREST: {
                            const sv = sampleData[pos]
                            targetBuffer[0][i] += sv * channel.leftVolume
                            targetBuffer[1][i] += sv * channel.rightVolume
                            break
                        }

                        case SoftwareWavetable.INTERPOLATION.BLEP: {
                            const sv = blep.mixSample(channelNr, sampleData[pos] * channel.ampVolume, pos, samplePosition - pos)
                            targetBuffer[0][i] += sv * channel.leftPanGain
                            targetBuffer[1][i] += sv * channel.rightPanGain
                            break
                        }

                        case SoftwareWavetable.INTERPOLATION.LINEAR: {
                            const sv0 = sampleData[pos]
                            const sv1 = sampleData[pos + 1]
                            const sv = sv0 + (sv1 - sv0) * (samplePosition - pos)
                            targetBuffer[0][i] += sv * channel.leftVolume
                            targetBuffer[1][i] += sv * channel.rightVolume
                            break
                        }

                        case SoftwareWavetable.INTERPOLATION.WATTE: {
                            const x = samplePosition - pos
                            const ym1py2 = sampleData[pos - 1] + sampleData[pos + 2]
                            const c0 = sampleData[pos]
                            const sv2 = sampleData[pos + 1]
                            const c1 = 1.5 * sv2 - .5 * (c0 + ym1py2)
                            const c2 = 0.5 * (ym1py2 - c0 - sv2)
                            const sv = (c2 * x + c1) * x + c0
                            targetBuffer[0][i] += sv * channel.leftVolume
                            targetBuffer[1][i] += sv * channel.rightVolume
                            break
                        }
                    }

                    // Adjust to next sample position

                    samplePosition += channel.speed
                }
            }
        })
    }

    /**
     * Return information about wavetable channels.
     *
     * @returns {object[]}
     *      Array of objects with status for each channel.
     */

    getMixerInfo() {
        return this.channels.map(channel => {
            return {
                samplePosition: channel.samplePosition,
                sampleRate: channel.sampleRate,
                speed: channel.speed,
                volume: channel.volumeRampSteps ? channel.targetVolume : channel.volume,
                pan: channel.pan
            }
        })
    }
}

/**
 * BLEP oversampler from pt2-clone adapted to tmodplay's generic wavetable.
 * https://github.com/8bitbubsy/pt2-clone
 *
 * This is licensed under the BSD 3-Clause License which applies to the entire
 * code in the BLEPResampler class.
 *
 * Copyright (c) 2010-2024, Olav Sørensen
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * 3. Neither the name of the copyright holder nor the names of its
 *    contributors may be used to endorse or promote products derived from
 *    this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

class BLEPResampler {

    /* aciddose:
    ** information on blep variables
    **
    ** ZC = zero crossings, the number of ripples in the impulse
    ** OS = oversampling, how many samples per zero crossing are taken
    ** SP = step size per output sample, used to lower the cutoff (play the impulse slower)
    ** NS = number of samples of impulse to insert
    ** RNS = the lowest power of two greater than NS, minus one (used to wrap output buffer)
    **
    ** ZC and OS are here only for reference, they depend upon the data in the table and can't be changed.
    ** SP, the step size can be any number lower or equal to OS, as long as the result NS remains an integer.
    ** for example, if ZC=8,OS=5, you can set SP=1, the result is NS=40, and RNS must then be 63.
    ** the result of that is the filter cutoff is set at nyquist * (SP/OS), in this case nyquist/5.
    */

    static BLEP_ZC = 16
    static BLEP_OS = 16
    static BLEP_SP = 16
    static BLEP_NS = BLEPResampler.BLEP_ZC * BLEPResampler.BLEP_OS / BLEPResampler.BLEP_SP
    static BLEP_RNS = 31 // RNS = (2^ > NS) - 1

    static minBlepData = [
         1.000047730261351741631870027, 1.000070326525919428561905988, 1.000026295486963423542192686, 0.999910424773336803383472216,
         0.999715744379055859525351480, 0.999433014919733908598686867, 0.999050085771328588712947294, 0.998551121919525108694415394,
         0.997915706233591937035498631, 0.997117832692634098457062919, 0.996124815495205595539118804, 0.994896148570364013963285288,
         0.993382359323431773923118726, 0.991523909003057091204880180, 0.989250199364479221308954493, 0.986478750833182482793404233,
         0.983114620682589257505412661, 0.979050130425507592057954298, 0.974164969358674692756494551, 0.968326735771705471300663248,
         0.961391968634788374181709969, 0.953207710646355677042151910, 0.943613628528589098998224927, 0.932444698727279863703643059,
         0.919534446669115101968827730, 0.904718706053873278349897191, 0.887839842029686909796737382, 0.868751359331251915563143484,
         0.847322794437510795617640724, 0.823444770447693374926245724, 0.797034075604916458779314326, 0.768038612100722994924240083,
         0.736442051783192774827568883, 0.702268030364621043126760469, 0.665583712234169455612686761, 0.626502564400415073997407944,
         0.585186190589438104403541274, 0.541845095055891845525763983, 0.496738269945924404424886234, 0.450171529567763739621000241,
         0.402494548939336449500103754, 0.354096601546017020201162495, 0.305401031227847563620514393, 0.256858534249934655768754510,
         0.208939368513054252174399039, 0.162124646097439151226637932, 0.116896901459689991908952322, 0.073730159227936173382822460,
         0.033079751373986221452128120,-0.004627847551233893637345762,-0.039004887382349466562470042,-0.069711629260494178961238276,
        -0.096464776709362487494558991,-0.119044790560825133884925719,-0.137301851759562276722448360,-0.151160268717908163882412964,
        -0.160621165999489917686204876,-0.165763337555641210308010614,-0.166742199141503621984128358,-0.163786829309547077304642926,
        -0.157195144771094669211564110,-0.147327312088839507131510231,-0.134597551740997606328775760,-0.119464540741507418974975963,
        -0.102420664473805989036492292,-0.083980405628003879092702277,-0.064668186778692057781192659,-0.045006002136687713044427284,
        -0.025501182606377806316722001,-0.006634636085273460347211394, 0.011150108072625494748386643, 0.027456744995838545247979212,
         0.041944658451493331552395460, 0.054335772988313046916175608, 0.064419613137017092685532305, 0.072056443764197217194400480,
         0.077178424602408784993556878, 0.079788772844964592212413379, 0.079958988468210145938996902, 0.077824255600564926083073658,
         0.073577187846729327769246254, 0.067460134194076051827870799, 0.059756303384108616638670242, 0.050779997099921050929260957,
         0.040866264989502618099059816, 0.030360306751458156215850437, 0.019606947961234157812304701, 0.008940507097049575288560952,
        -0.001324648208126466466388882,-0.010902586500777250097526938,-0.019543107356485005243751374,-0.027037657667711743197935803,
        -0.033223730539404389139335194,-0.037987660680654206091233505,-0.041265784496258707536586741,-0.043043987097204458591725995,
        -0.043355710312406585404954029,-0.042278543756813086185175621,-0.039929563528408616723819335,-0.036459618831699062979634363,
        -0.032046794692908199542191738,-0.026889298182776331241905510,-0.021198025763611533928143515,-0.015189070430455576393713457,
        -0.009076419455364113236806034,-0.003065077316892155564337363, 0.002655175361548794011473662, 0.007915206247809156159256361,
         0.012570993866018958726171739, 0.016507022146950881685834034, 0.019638542128970374461838233, 0.021912677934460975809338734,
         0.023308395228452325614876273, 0.023835389125096861917540991, 0.023531983633596965932444078, 0.022462165098004915897433875,
         0.020711896771322700627759872, 0.018384880003473082210607714, 0.015597939105523964467558962, 0.012476211636472618604631890,
         0.009148323764166686397625305, 0.005741721847351755579624832, 0.002378317065490789024989615,-0.000829419425005380466127403,
        -0.003781796760683148444365242,-0.006394592475568152724341164,-0.008601029202315702004710829,-0.010353009833494400057651852,
        -0.011621609729198234539637724,-0.012396851839770069853008394,-0.012686815497510708569683935,-0.012516151297987356677543502,
        -0.011924092281628086154032786,-0.010962065062340150406461348,-0.009691013345942120493781147,-0.008178550345073604815882007,
        -0.006496056025074358440674072,-0.004715830178801836899959987,-0.002908403455554361104196115,-0.001140096220006421448914247,
         0.000529099845866712065883819, 0.002047259427257062253113773, 0.003371840725899812995364213, 0.004470560830528139475981142,
         0.005321826318522163493107691, 0.005914733331712991419581993, 0.006248666963769690732566353, 0.006332543236118748190832672,
         0.006183747823531677602348910, 0.005826833745009315536356187, 0.005292045316197638814281756, 0.004613737750803969042689978,
         0.003828761006839943078355892, 0.002974873016054367744903653, 0.002089241623845963964634098, 0.001207086791118088800120467,
         0.000360505313776118753877481,-0.000422490021201840063209965,-0.001118695810940623525803206,-0.001710197865787731110603920,
        -0.002184605984988852254297109,-0.002535053949380879686342771,-0.002759983640474954029453425,-0.002862739419386348127538611,
        -0.002851004510552685496799219,-0.002736115017663406229209144,-0.002532289317276390557681642,-0.002255810970882980801693884,
        -0.001924202080457771161722813,-0.001555421358101014960712005,-0.001167117308478276627506376,-0.000775962090624877551779670,
        -0.000397086112821087974713435,-0.000043627508742770710237387, 0.000273595371614305691784774, 0.000546286179945486565119606,
         0.000768750680536383766867925, 0.000937862797633428843004089, 0.001052928740415311594305625, 0.001115464566897328381120391,
         0.001128904823558016723081265, 0.001098261208043675284801166, 0.001029750572351520628011645, 0.000930411077785372455858925,
         0.000807724029027989654482000, 0.000669256978018619233528064, 0.000522341243078797709889494, 0.000373794189875729877727689,
         0.000229693626208723626408101, 0.000095208625460110475721871,-0.000025511844279469758173208,-0.000129393822077144692462430,
        -0.000214440509776957504047001,-0.000279687383686450809737456,-0.000325117484787396354272565,-0.000351545144152561614761532,
        -0.000360476947384593608518510,-0.000353958823942885139873099,-0.000334417806276329982514278,-0.000304506298090264292902779,
        -0.000266955691183075056582136,-0.000224444953912546549387383,-0.000179488462294699944012469,-0.000134345936549333598141603,
        -0.000090955956048889888797271,-0.000050893220267083281950406,-0.000015348557788785960678823, 0.000014870297520588306796089,
         0.000039319915274267510328903, 0.000057887658269859997505705, 0.000070747063526119185008535, 0.000078305819543209774719408,
         0.000081149939344861922907622, 0.000079987451948008292520673, 0.000075594520611004130655058, 0.000068766382254997158183021,
         0.000060274927715552435942073, 0.000050834144795034220151546, 0.000041074060306237671633470, 0.000031523273709852359548023,
         0.000022599698095009569128290, 0.000014608732178951863478521, 0.000007747790946751235789929, 0.000002115927046159247276264,
        -0.000002272821614624657917699,-0.000005473727618614671290435,-0.000007594607649309153682893,-0.000008779148282948222000235,
        -0.000009191289914471795693680,-0.000009001415957147717553273,-0.000008374862616584595860708,-0.000007463035714495605026032,
        -0.000006397209079216532043657,-0.000005284894977678962862369,-0.000004208528817468251939280,-0.000003226102468093129124012,
        -0.000002373314390120065336351,-0.000001666778737492929471595,-0.000001107845639559032712541,-0.000000686624974759576246945,
        -0.000000385868818649388185867,-0.000000184445440432801241354,-0.000000060222272723601931954, 0.000000007740724047001495273,
         0.000000037708832885684096027, 0.000000044457942869060847864, 0.000000039034296310091607592, 0.000000028962932871006776366,
         0.000000018763994698223029203, 0.000000010636937008622986639, 0.000000005187099504706206719, 0.000000002093670467469700098,
         0.000000000648951812097509606, 0.000000000132018063854003986, 0.000000000011591335682393882, 0.000000000000000000000000000,
         0.000000000000000000000000000 // 8bitbubsy: one extra zero is required for interpolation look-up
    ]

    constructor() {
        this.channels = []
    }

    /**
     * Set the number of channels supported by the BLEP interpolator.
     *
     * @param {number} numChannels
     *      Number of simultaneous active channels.
     */

    setNumChannels(numChannels) {
        let i = this.channels.length
        this.channels.length = numChannels

        while (i < numChannels) {
            this.resetChannel(i)
            i++
        }
    }

    /**
     * Reset a BLEP interpolator channel to its initial state.
     *
     * @param {number} channelNr
     *      Index of channel to reset.
     */

    resetChannel(channelNr) {
        if (channelNr >= this.channels.length) {
            return
        }

        this.channels[channelNr] = {
            speed: 0,
            lastSpeed: 0,
            lastSamplePosition: 0,
            lastSamplePositionFraction: 0,
            lastSampleValue: 0,
            blepSampleIndex: 0,
            blepSamplesLeft: 0,
            blepSampleBuffer: new Array(BLEPResampler.BLEP_RNS + 1).fill(0)
        }
    }

    /**
     * Set the mixing speed of a BLEP interpolator channel.
     *
     * @param {number} channelNr
     *      Index of channel.
     * @param {number} speed
     *      Mixing speed relative to the output sample rate. BLEP interpolation
     *      cannot work for speeds above 1, it will act as a nearest neighbor
     *      interpolator in this case.
     */

    setSpeed(channelNr, speed) {
        const channel = this.channels[channelNr]
        channel.speed = speed
        if (speed >= 1) {
            channel.lastSpeed = 0
        } else {
            channel.lastSpeed = channel.lastSpeed || channel.speed
        }
    }

    /**
     * Initialize the BLEP resampler after a sample value change.
     *
     * @private
     * @param {object} channel
     *      BLEP resampler channel.
     * @param {number} offset
     *      BLEP interpolator offset (0 - 1).
     * @param {number} sampleValueChange
     *      Change in the sample value (-2 - 2).
     */

    blepAdd(channel, offset, sampleValueChange) {
        if (offset < 0 || offset >= 1) {
            return
        }

        let f = offset * BLEPResampler.BLEP_SP
        let i = Math.floor(f)
        f -= i
        let blepSrc = i
        i = channel.blepSampleIndex

        for (let n = 0; n < BLEPResampler.BLEP_NS; n++) {
            const x = BLEPResampler.minBlepData[blepSrc]
            const y = BLEPResampler.minBlepData[blepSrc + 1]
            channel.blepSampleBuffer[i] += sampleValueChange * (x + (y - x) * f)
            blepSrc += BLEPResampler.BLEP_SP
            i = (i + 1) & BLEPResampler.BLEP_RNS
        }

        channel.blepSamplesLeft = BLEPResampler.BLEP_NS
    }

    /**
     * Add BLEP sample value on top of nearest neighbor sample value.
     *
     * @private
     * @param {object} channel
     *      BLEP resampler channel.
     * @param {number} sampleValue
     *      Current nearest neighbor sample value (-1 - 1).
     * @returns
     *      Nearest neighbor sample value + BLEP sample value.
     */

    blepRun(channel, sampleValue) {
        sampleValue += channel.blepSampleBuffer[channel.blepSampleIndex]
        channel.blepSampleBuffer[channel.blepSampleIndex] = 0

        channel.blepSampleIndex = (channel.blepSampleIndex + 1) & BLEPResampler.BLEP_RNS
        channel.blepSamplesLeft--

        return sampleValue
    }

    /**
     * Apply BLEP interpolation on top of nearest neighbor sample value.
     *
     * @param {number} channelNr
     *      Index of channel.
     * @param {number} sampleValue
     *      Current nearest neighbor sample value (-1 - 1).
     * @param {number} samplePosition
     *      Integer part of the current sample position.
     * @param {number} samplePositionFraction
     *      Fractional part of the current sample position.
     * @returns
     *      Nearest neighbor sample value + BLEP sample value.
     */

    mixSample(channelNr, sampleValue, samplePosition, samplePositionFraction) {
        const channel = this.channels[channelNr]

        // Cannot BLEP when speed >= 1, just do nearest neighbor in this case

        if (!channel || channel.speed >= 1) {
            return sampleValue
        }

        // Position changed, update BLEP parameters

        if (samplePosition !== channel.lastSamplePosition) {
            channel.lastSamplePosition = samplePosition
            channel.lastSamplePositionFraction = samplePositionFraction
            channel.lastSpeed = channel.speed
        }

        // Sample value changed, fill BLEP buffer

        if (sampleValue !== channel.lastSampleValue) {
            if (channel.lastSpeed > channel.lastSamplePositionFraction) {
                this.blepAdd(channel, channel.lastSamplePositionFraction / channel.lastSpeed, channel.lastSampleValue - sampleValue)
            }

            channel.lastSampleValue = sampleValue
        }

        // Apply BLEP on sample value

        if (channel.blepSamplesLeft > 0) {
            sampleValue = this.blepRun(channel, sampleValue)
        }

        return sampleValue
    }
}