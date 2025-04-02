/**
 * Table for Amiga period to note/octave conversion.
 */

const noteTable = [
    3424, 3232, 3048, 2880, 2712, 2560, 2416, 2280, 2152, 2032, 1920, 1812,
	1712, 1616, 1524, 1440, 1356, 1280, 1208, 1140, 1076, 1016, 960, 906,
	856, 808, 762, 720, 678, 640, 604, 570, 538, 508, 480, 453,
	428, 404, 381, 360, 339, 320, 302, 285, 269, 254, 240, 226, // Octave 0
	214, 202, 190, 180, 170, 160, 151, 143, 135, 127, 120, 113,
	107, 101, 95, 90, 85, 80, 75, 71, 67, 63, 60, 56,
	53, 50, 47, 45, 42, 40, 37, 35, 33, 31, 30, 28
]

/**
 * Base period for internal note/octave representation. This corresponds to
 * Amiga period 428, which is the period used for Protracker note C-2. This will
 * internally become note 0, octave 0.
 */

const noteC2 = 428

/**
 * Get the index of the first period in noteTable array that is equal or less,
 * than the provided period value.
 *
 * @param {number} period
 * @returns {number}
 *      Index into noteTable or -1 if the value was not found.
 */

function periodIndex(period) {
    for (let i = 0; i < noteTable.length; i++) {
        if (noteTable[i] <= period) {
            return i
        }
    }

    return -1
}

/**
 * Conversion table for IBM code page 437 character codes 127 - 255 to Unicode
 * code points from https://en.wikipedia.org/wiki/Code_page_437.
 */

const cp437High = [                                         0x2302, // 127
    0x00C7, 0x00FC, 0x00E9, 0x00E2, 0x00E4, 0x00E0, 0x00E5, 0x00E7, // 128 - 135
    0x00EA, 0x00EB, 0x00E8, 0x00EF, 0x00EE, 0x00EC, 0x00C4, 0x00C5, // 136 - 143
    0x00C9, 0x00E6, 0x00C6, 0x00F4, 0x00F6, 0x00F2, 0x00FB, 0x00F9, // 144 - 151
    0x00FF, 0x00D6, 0x00DC, 0x00A2, 0x00A3, 0x00A5, 0x20A7, 0x0192, // 152 - 159
    0x00E1, 0x00ED, 0x00F3, 0x00FA, 0x00F1, 0x00D1, 0x00AA, 0x00BA, // 160 - 167
    0x00BF, 0x2310, 0x00AC, 0x00BD, 0x00BC, 0x00A1, 0x00AB, 0x00BB, // 168 - 175
    0x2591, 0x2592, 0x2593, 0x2502, 0x2524, 0x2561, 0x2562, 0x2556, // 176 - 183
    0x2555, 0x2563, 0x2551, 0x2557, 0x255D, 0x255C, 0x255B, 0x2510, // 184 - 191
    0x2514, 0x2534, 0x252C, 0x251C, 0x2500, 0x253C, 0x255E, 0x255F, // 192 - 199
    0x255A, 0x2554, 0x2569, 0x2566, 0x2560, 0x2550, 0x256C, 0x2567, // 200 - 207
    0x2568, 0x2564, 0x2565, 0x2559, 0x2558, 0x2552, 0x2553, 0x256B, // 208 - 215
    0x256A, 0x2518, 0x250C, 0x2588, 0x2584, 0x258C, 0x2590, 0x2580, // 216 - 223
    0x03B1, 0x00DF, 0x0393, 0x03C0, 0x03A3, 0x03C3, 0x00B5, 0x03C4, // 224 - 231
    0x03A6, 0x0398, 0x03A9, 0x03B4, 0x221E, 0x03C6, 0x03B5, 0x2229, // 232 - 239
    0x2261, 0x00B1, 0x2265, 0x2264, 0x2320, 0x2321, 0x00F7, 0x2248, // 240 - 247
    0x00B0, 0x2219, 0x00B7, 0x221A, 0x207F, 0x00B2, 0x25A0, 0x0020  // 248 - 255
]

/**
 * Convert a part of a binary buffer containing IBM code page 437 encoded ASCIIZ
 * text to a native (UTF-8) string.
 *
 * @param {ArrayBuffer} buffer
 *      Binary buffer containing the text.
 * @param {number} start
 *      Start offset of the string within the buffer.
 * @param {number} length
 *      Maximum length of the string in the buffer.
 * @returns {string}
 *      Native string.
 */

function binToString(buffer, start, length) {
    const uintBuffer = new Uint8Array(buffer, start, length)
    let text = ""

    for (let i = 0; i < length; i++) {
        let code = uintBuffer[i]

        if (code === 0) {
            break
        } else if (code <= 31) {
            text += " "
        } else if (code >= 127) {
            text += String.fromCharCode(cp437High[code - 127])
        } else {
            text += String.fromCharCode(code)
        }
    }

    return text
}

/**
 * Convert a big-endian 16-bit value from a binary buffer to a native number.
 *
 * @param {ArrayBuffer} buffer
 *      Binary buffer containing the text.
 * @param {number} offset
 *      Position of the 16-bit value within the binary buffer.
 * @returns {number}
 *      Native number.
 */

function binBEWordToNumber(buffer, offset) {
    const bytes = new Uint8Array(buffer, offset, offset + 2)

    return (bytes[0] << 8) + bytes[1]
}

/**
 * Parse a Protracker or compatible clone/multichannel MOD file from a binary
 * buffer into a native object representing the song (track).
 *
 * @param {ArrayBuffer} file
 *      Binary buffer containing the MOD file.
 * @returns {object}
 *      An object containing the song.
 */

export function loadProtrackerMOD(file) {
    const uintFile = new Uint8Array(file)

    if (uintFile.length < 1084) {
        throw new Error("Not a MOD file")
    }

    const tag = binToString(file, 1080, 4)
    const track = {
        type: "MOD",
        title: binToString(file, 0, 20),
        patterns: [],
        sequence: [],
        samples: [],
        restartSequence: 0,
        numChannels: 0,
        features: {}
    }

    // Determine number of channels based on MOD tag

    let numChannels = 4

    if (tag.substring(1) === "CHN") {
        numChannels = parseInt(tag[0], 10)
    } else if (tag.substring(2) === "CH") {
        numChannels = parseInt(tag.substring(0, 2), 10)
    } else if (tag === "OCTA" || tag === "CD81") {
        numChannels = 8
    } else if (tag.substring(0, 3) === "TDZ") {
        numChannels = parseInt(tag[3], 10)
    } else if (["M.K.", "M!K!", "FLT4"].indexOf(tag) < 0) {
        throw new Error(`Not a MOD file or unrecognized MOD format (tag: ${tag})`)
    }

    track.numChannels = numChannels

    // Add sequences

    let numPatterns = 0
    let numSequenceEntries = uintFile[950]
    for (let i = 0, ofs = 952; i < 128; i++, ofs++) {
        let patternIndex = uintFile[ofs]
        if (patternIndex > numPatterns) {
            numPatterns = patternIndex
        }
        if (i < numSequenceEntries) {
            track.sequence[i] = patternIndex
        }
    }
    numPatterns++

    // Add samples

    let sampleOffset = 1084 + (numPatterns << 8) * numChannels

    if (uintFile.length < sampleOffset) {
        throw new Error("Incomplete pattern data, MOD file is corrupted")
    }

    for (let i = 0, ofs = 20; i < 31; i++, ofs += 30) {
        let instrumentSample = {
            name: binToString(file, ofs, 22),
            finetune: uintFile[ofs + 24],
            volume: uintFile[ofs + 25],
            loopStart: binBEWordToNumber(file, ofs + 26) << 1,
            loopLength: binBEWordToNumber(file, ofs + 28) << 1,
            audioSample: null
        }
        if (instrumentSample.finetune >= 8) {
            instrumentSample.finetune -= 16
        }

        // Clamp sample length to not extend beyond physical file

        let length = binBEWordToNumber(file, ofs + 22) << 1
        if (sampleOffset + length > uintFile.length) {
            track.features.incompleteSamples = track.features.incompleteSamples || []
            track.features.incompleteSamples[i] = {
                expectedLength: length,
                actualLength: uintFile.length - sampleOffset
            }
            length = uintFile.length - sampleOffset
        }

        // Clamp loop points to sample boundaries

        if (instrumentSample.loopStart >= length || instrumentSample.loopLength <= 2) {
            instrumentSample.loopStart = instrumentSample.loopLength = 0
        } else if (instrumentSample.loopStart + instrumentSample.loopLength > length) {
            instrumentSample.loopLength = length - instrumentSample.loopStart
        }

        // Assign sample

        if (length > 0) {
            instrumentSample.audioSample = new Int8Array(file, sampleOffset, length)
        }
        track.samples[i] = instrumentSample

        sampleOffset += length
    }

    // Add patterns

    let numNotes = (numPatterns << 6) * numChannels
    let channel = numChannels
    let row = 63
    let patternIndex = -1
    let pattern, patternRow
    const noteBase = noteTable.indexOf(noteC2)

    for (let i = 0, ofs = 1084; i < numNotes; i++, ofs += 4) {

        // Pre-adjust position

        channel++
        if (channel >= numChannels) {
            channel = 0
            row++
            if (row >= 64) {
                row = 0
                patternIndex++
                pattern = {
                    rows: []
                }
                track.patterns[patternIndex] = pattern
            }
            patternRow = {
                notes: []
            }
            pattern.rows[row] = patternRow
        }

        let patternNote = {
            note: -1,
            octave: 0,
            sampleIndex: ((uintFile[ofs] & 0xf0) + (uintFile[ofs + 2] >> 4)) - 1,
            fx: uintFile[ofs + 2] & 0x0f,
            fxParam: uintFile[ofs + 3]
        }

        // Convert period to note

        let period = ((uintFile[ofs] & 0x0f) << 8) + uintFile[ofs + 1]
        let note = periodIndex(period)
        if (note < 0) {
            patternNote.note = -1
        } else {
            patternNote.octave = Math.floor((note - noteBase) / 12)
            patternNote.note = note % 12
            if (patternNote.octave < -1 || patternNote.octave > 1) {
                track.features.nonStandardNotes = true
            }
        }

        // Save effect, convert E8 XY effects to effect = 0x1X, param = 0x0Y

        if (patternNote.fx === 0x0e) {
            patternNote.fx = 0x10 + (patternNote.fxParam >> 4)
            patternNote.fxParam &= 0x0f
        }
        if (patternNote.fx === 0x08 || patternNote.fx === 0x18) {
            track.features.panCommands = true
        }
        patternRow.notes[channel] = patternNote
    }

    return track
}