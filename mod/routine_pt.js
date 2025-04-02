import { Playroutine } from "./routine.js"
import { Wavetable, amigaChannelPan } from "./wtbl.js"

/**
 * Amiga base clocks for frequency calculations.
 */

const baseClocks = {

    /**
     * PAL base clock (7.093790 MHz)
     */

    pal: 28.37516 / 4 * 1000000,

    /**
     * NTSC base clock (7.159091 MHz)
     */

    ntsc: 315 / 22 * 1000000 / 2
}

/**
 * Convert a MOD period into an internal period (multiply by 16 - not using
 * bitshift because this may be a negative number for period differences).
 *
 * @param {number} modPeriod
 *      Amiga MOD period.
 * @returns {number}
 */

function period(modPeriod) {
    return modPeriod * 16
}

/**
 * Period tables
 *
 * 16 tables for each finetune step between -8 and +7. The range is extended by
 * two octaves beyond standard Protracker. Periods are multiplied by 16 to
 * enable more fine-grained finetune for the extended octaves. The standard
 * Protracker octaves follow original values.
 */

const noteTable = [

    // Tuning -8
    58048, 54784, 51712, 48768, 46080, 43392, 40960, 38656, 36480, 34432, 32512, 30720,
    29024, 27392, 25856, 24384, 23040, 21696, 20480, 19328, 18240, 17216, 16256, 15360,
    14512, 13696, 12928, 12192, 11520, 10848, 10240, 9664, 9120, 8608, 8128, 7680,
    7248, 6848, 6464, 6096, 5760, 5424, 5120, 4832, 4560, 4304, 4064, 3840,
    3616, 3424, 3232, 3040, 2880, 2720, 2560, 2416, 2288, 2160, 2032, 1920,
    1808, 1712, 1616, 1520, 1440, 1360, 1280, 1208, 1144, 1080, 1016, 960,
    904, 856, 808, 760, 720, 680, 640, 604, 572, 540, 508, 480,

    // Tuning -7
    57600, 54400, 51328, 48448, 45760, 43200, 40704, 38464, 36288, 34240, 32320, 30528,
    28800, 27200, 25664, 24224, 22880, 21600, 20352, 19232, 18144, 17120, 16160, 15264,
    14400, 13600, 12832, 12112, 11440, 10800, 10176, 9616, 9072, 8560, 8080, 7632,
    7200, 6800, 6416, 6064, 5712, 5392, 5088, 4800, 4544, 4288, 4048, 3808,
    3600, 3392, 3200, 3024, 2864, 2704, 2544, 2400, 2272, 2144, 2016, 1904,
    1800, 1696, 1600, 1512, 1432, 1352, 1272, 1200, 1136, 1072, 1008, 952,
    900, 848, 800, 756, 716, 676, 636, 600, 568, 536, 504, 476,

    // Tuning -6
    57216, 54016, 50944, 48128, 45376, 42880, 40448, 38208, 36032, 34048, 32128, 30336,
    28608, 27008, 25472, 24064, 22688, 21440, 20224, 19104, 18016, 17024, 16064, 15168,
    14304, 13504, 12736, 12032, 11344, 10720, 10112, 9552, 9008, 8512, 8032, 7584,
    7152, 6752, 6368, 6016, 5680, 5360, 5056, 4768, 4512, 4256, 4016, 3792,
    3568, 3376, 3184, 3008, 2832, 2672, 2528, 2384, 2256, 2128, 2000, 1888,
    1784, 1688, 1592, 1504, 1416, 1336, 1264, 1192, 1128, 1064, 1000, 944,
    892, 844, 796, 752, 708, 668, 632, 596, 564, 532, 500, 472,

    // Tuning -5
    56768, 53632, 50624, 47744, 45056, 42560, 40192, 37888, 35776, 33792, 31872, 30080,
    28384, 26816, 25312, 23872, 22528, 21280, 20096, 18944, 17888, 16896, 15936, 15040,
    14192, 13408, 12656, 11936, 11264, 10640, 10048, 9472, 8944, 8448, 7968, 7520,
    7104, 6704, 6320, 5968, 5632, 5312, 5024, 4736, 4480, 4224, 3984, 3760,
    3552, 3344, 3168, 2992, 2816, 2656, 2512, 2368, 2240, 2112, 2000, 1888,
    1776, 1672, 1584, 1496, 1408, 1328, 1256, 1184, 1120, 1056, 1000, 944,
    888, 836, 792, 748, 704, 664, 628, 592, 560, 528, 500, 472,

    // Tuning -4
    56384, 53248, 50240, 47424, 44736, 42240, 39872, 37632, 35520, 33536, 31616, 29888,
    28192, 26624, 25120, 23712, 22368, 21120, 19936, 18816, 17760, 16768, 15808, 14944,
    14096, 13312, 12560, 11856, 11184, 10560, 9968, 9408, 8880, 8384, 7904, 7472,
    7056, 6656, 6272, 5920, 5600, 5280, 4992, 4704, 4448, 4192, 3952, 3728,
    3520, 3328, 3136, 2960, 2800, 2640, 2496, 2352, 2224, 2096, 1968, 1872,
    1760, 1664, 1568, 1480, 1400, 1320, 1248, 1176, 1112, 1048, 984, 936,
    880, 832, 784, 740, 700, 660, 624, 588, 556, 524, 492, 468,

    // Tuning -3
    56000, 52864, 49856, 47104, 44416, 41920, 39616, 37376, 35264, 33280, 31424, 29632,
    28000, 26432, 24928, 23552, 22208, 20960, 19808, 18688, 17632, 16640, 15712, 14816,
    14000, 13216, 12464, 11776, 11104, 10480, 9904, 9344, 8816, 8320, 7856, 7408,
    6992, 6608, 6240, 5888, 5552, 5248, 4944, 4672, 4416, 4160, 3920, 3712,
    3504, 3296, 3120, 2944, 2784, 2624, 2480, 2336, 2208, 2080, 1968, 1856,
    1752, 1648, 1560, 1472, 1392, 1312, 1240, 1168, 1104, 1040, 984, 928,
    876, 824, 780, 736, 696, 656, 620, 584, 552, 520, 492, 464,

    // Tuning -2
    55552, 52480, 49536, 46720, 44096, 41664, 39296, 37120, 35008, 33024, 31168, 29440,
    27776, 26240, 24768, 23360, 22048, 20832, 19648, 18560, 17504, 16512, 15584, 14720,
    13888, 13120, 12384, 11680, 11024, 10416, 9824, 9280, 8752, 8256, 7792, 7360,
    6944, 6560, 6192, 5840, 5520, 5200, 4912, 4640, 4384, 4128, 3904, 3680,
    3472, 3280, 3088, 2928, 2752, 2608, 2464, 2320, 2192, 2064, 1952, 1840,
    1736, 1640, 1544, 1464, 1376, 1304, 1232, 1160, 1096, 1032, 976, 920,
    868, 820, 772, 732, 688, 652, 616, 580, 548, 516, 488, 460,

    // Tuning -1
    55168, 52096, 49152, 46400, 43776, 41344, 39040, 36800, 34752, 32832, 30976, 29248,
    27584, 26048, 24576, 23200, 21888, 20672, 19520, 18400, 17376, 16416, 15488, 14624,
    13792, 13024, 12288, 11600, 10944, 10336, 9760, 9200, 8688, 8208, 7744, 7312,
    6896, 6512, 6144, 5808, 5472, 5168, 4880, 4608, 4352, 4096, 3872, 3648,
    3456, 3248, 3072, 2896, 2736, 2576, 2432, 2304, 2176, 2048, 1936, 1824,
    1728, 1624, 1536, 1448, 1368, 1288, 1216, 1152, 1088, 1024, 968, 912,
    864, 812, 768, 724, 684, 644, 608, 576, 544, 512, 484, 456,

    // Tuning 0
    // Extend below ProTracker range by 2 octaves
    54784, 51712, 48768, 46080, 43392, 40960, 38656, 36480, 34432, 32512, 30720, 28992,
    27392, 25856, 24384, 23040, 21696, 20480, 19328, 18240, 17216, 16256, 15360, 14496,
    // ProTracker range
    13696, 12928, 12192, 11520, 10848, 10240, 9664, 9120, 8608, 8128, 7680, 7248,
    6848, 6464, 6096, 5760, 5424, 5120, 4832, 4560, 4304, 4064, 3840, 3616,
    3424, 3232, 3040, 2880, 2720, 2560, 2416, 2288, 2160, 2032, 1920, 1808,
    // Extend above ProTracker range by 2 octaves
    1712, 1616, 1520, 1440, 1360, 1280, 1208, 1144, 1080, 1016, 960, 904,
    856, 808, 760, 720, 680, 640, 604, 572, 540, 508, 480, 452,

    // Tuning 1
    54400, 51328, 48448, 45760, 43136, 40768, 38464, 36288, 34240, 32320, 30528, 28800,
    27200, 25664, 24224, 22880, 21568, 20384, 19232, 18144, 17120, 16160, 15264, 14400,
    13600, 12832, 12112, 11440, 10784, 10192, 9616, 9072, 8560, 8080, 7632, 7200,
    6800, 6416, 6064, 5712, 5392, 5088, 4800, 4544, 4288, 4048, 3824, 3600,
    3408, 3216, 3024, 2864, 2704, 2544, 2400, 2272, 2144, 2016, 1904, 1808,
    1704, 1608, 1512, 1432, 1352, 1272, 1200, 1136, 1072, 1008, 952, 904,
    852, 804, 756, 716, 676, 636, 600, 568, 536, 504, 476, 452,

    // Tuning 2
    54016, 50944, 48128, 45376, 42880, 40448, 38208, 36032, 34048, 32128, 30336, 28608,
    27008, 25472, 24064, 22688, 21440, 20224, 19104, 18016, 17024, 16064, 15168, 14304,
    13504, 12736, 12032, 11344, 10720, 10112, 9552, 9008, 8512, 8032, 7584, 7152,
    6752, 6368, 6016, 5680, 5360, 5056, 4768, 4512, 4256, 4016, 3792, 3584,
    3376, 3184, 3008, 2832, 2672, 2528, 2384, 2256, 2128, 2000, 1888, 1792,
    1688, 1592, 1504, 1416, 1336, 1264, 1192, 1128, 1064, 1000, 944, 896,
    844, 796, 752, 708, 668, 632, 596, 564, 532, 500, 472, 448,

    // Tuning 3
    53632, 50624, 47744, 45056, 42560, 40192, 37888, 35776, 33792, 31872, 30080, 28416,
    26816, 25312, 23872, 22528, 21280, 20096, 18944, 17888, 16896, 15936, 15040, 14208,
    13408, 12656, 11936, 11264, 10640, 10048, 9472, 8944, 8448, 7968, 7520, 7104,
    6704, 6320, 5968, 5632, 5312, 5024, 4736, 4480, 4224, 3984, 3760, 3552,
    3344, 3168, 2992, 2816, 2656, 2512, 2368, 2240, 2112, 2000, 1888, 1776,
    1672, 1584, 1496, 1408, 1328, 1256, 1184, 1120, 1056, 1000, 944, 888,
    836, 792, 748, 704, 664, 628, 592, 560, 528, 500, 472, 444,

    // Tuning 4
    53248, 50240, 47424, 44736, 42240, 39872, 37632, 35520, 33536, 31680, 29888, 28224,
    26624, 25120, 23712, 22368, 21120, 19936, 18816, 17760, 16768, 15840, 14944, 14112,
    13312, 12560, 11856, 11184, 10560, 9968, 9408, 8880, 8384, 7920, 7472, 7056,
    6656, 6272, 5920, 5600, 5280, 4992, 4704, 4448, 4192, 3952, 3728, 3520,
    3328, 3136, 2960, 2800, 2640, 2496, 2352, 2224, 2096, 1984, 1872, 1760,
    1664, 1568, 1480, 1400, 1320, 1248, 1176, 1112, 1048, 992, 936, 880,
    832, 784, 740, 700, 660, 624, 588, 556, 524, 496, 468, 440,

    // Tuning 5
    52864, 49856, 47104, 44416, 41920, 39616, 37376, 35264, 33280, 31424, 29632, 27968,
    26432, 24928, 23552, 22208, 20960, 19808, 18688, 17632, 16640, 15712, 14816, 13984,
    13216, 12464, 11776, 11104, 10480, 9904, 9344, 8816, 8320, 7856, 7408, 6992,
    6608, 6240, 5888, 5552, 5248, 4944, 4672, 4416, 4160, 3920, 3712, 3504,
    3296, 3120, 2944, 2784, 2624, 2480, 2336, 2208, 2080, 1968, 1856, 1744,
    1648, 1560, 1472, 1392, 1312, 1240, 1168, 1104, 1040, 984, 928, 872,
    824, 780, 736, 696, 656, 620, 584, 552, 520, 492, 464, 436,

    // Tuning 6
    52480, 49536, 46720, 44096, 41664, 39296, 37120, 35008, 33024, 31168, 29440, 27776,
    26240, 24768, 23360, 22048, 20832, 19648, 18560, 17504, 16512, 15584, 14720, 13888,
    13120, 12384, 11680, 11024, 10416, 9824, 9280, 8752, 8256, 7792, 7360, 6944,
    6560, 6192, 5840, 5520, 5200, 4912, 4640, 4384, 4128, 3904, 3680, 3472,
    3280, 3088, 2928, 2752, 2608, 2464, 2320, 2192, 2064, 1952, 1840, 1744,
    1640, 1544, 1464, 1376, 1304, 1232, 1160, 1096, 1032, 976, 920, 872,
    820, 772, 732, 688, 652, 616, 580, 548, 516, 488, 460, 436,

    // Tuning 7
    52096, 49152, 46400, 43776, 41344, 39040, 36800, 34752, 32832, 30976, 29248, 27584,
    26048, 24576, 23200, 21888, 20672, 19520, 18400, 17376, 16416, 15488, 14624, 13792,
    13024, 12288, 11600, 10944, 10336, 9760, 9200, 8688, 8208, 7744, 7312, 6896,
    6512, 6144, 5808, 5472, 5168, 4880, 4608, 4352, 4096, 3872, 3648, 3456,
    3264, 3072, 2896, 2736, 2576, 2432, 2304, 2176, 2048, 1936, 1824, 1728,
    1632, 1536, 1448, 1368, 1288, 1216, 1152, 1088, 1024, 968, 912, 864,
    816, 768, 724, 684, 644, 608, 576, 544, 512, 484, 456, 432
]

/**
 * Length of each full range entry in the period table.
 */

const noteTableLength = noteTable.length / 16

/**
 * Period corresponding to Protracker C-2 note.
 */

const noteC2 = period(428)

/**
 * Index of Protracker C-2 note into period table (base note for octave 0).
 */

const noteBase = noteTable.slice(noteTableLength * 8, noteTableLength * 9).indexOf(noteC2) + noteTableLength * 8

/**
 * Protracker sine multiplier table for vibrato/tremolo
 */

const vibratoSineTab = [
      0,  24,  49,  74,  97, 120, 141, 161,
    180, 197, 212, 224, 235, 244, 250, 253,
    255, 253, 250, 244, 235, 224, 212, 197,
    180, 161, 141, 120,  97,  74,  49,  24
]

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
 * Calculate the period for a note and finetune value.
 *
 * @param {object} note
 *      Note and octave from a pattern note object.
 * @param {number} note.note
 *      Note (0 - 11).
 * @param {number} note.octave
 *      Octave (-3 - 3).
 * @param {number} finetune
 *      Finetune (-8 - 7).
 * @returns {number}
 *      Playback period.
 */

function notePeriod(note, finetune) {
    const noteIndex = noteBase + clamp(note.note, 0, 11) + clamp(note.octave, -3, 3) * 12
    return noteTable[noteIndex + clamp(finetune, -8, 7) * noteTableLength]
}

/**
 * Round down period to nearest seminote.
 *
 * @param {number} period
 *      Wanted playback period.
 * @param {number} finetune
 *      Finetune (-8 - 7)
 * @returns {number}
 *      Playback period of nearest seminote.
 */

function floorPeriod(period, finetune) {
    let noteTableStart = clamp(finetune, -8, 7) * noteTableLength
    let newNote

    for (let i = 0; i < noteTableLength; i++) {
        newNote = noteTable[noteTableStart + i]
        if (newNote <= period) {
            break
        }
    }

    return notePeriod(newNote, finetune)
}

/**
 * A playroutine for Protracker and compatible MOD files. Not perfect, but
 * should play most MODs out there just fine, even some of the problematic ones.
 *
 * Unsupported effects/quirks:
 * - Sample swap: Amiga hardware-specific
 * - E0x - Set filter: Amiga hardware-specific
 * - EFx - Funk it / Invert loop: Rare
 *
 * Supported non-Protracker effects:
 * - 8xx - Set fine panning (xx = 00 - ff), 00 = far left, ff = far right
 * - E8x - Set panning (x = 0 - f), 0 = far left, f = far right
 */

export class ProtrackerPlayroutine extends Playroutine {

    /**
     * State of the playroutine.
     */

    static STATE = {

        /**
         * The playroutine is initialized but has not yet processed any ticks.
         */

        INITIALIZED: 0,

        /**
         * The playroutine processed at least one tick since it has been created
         * or initialized via reset().
         */

        RUNNING: 1
    }

    /**
    * Playroutine sequence control flags.
    */

    static SEQUENCE = {

        /**
        * Break pattern after current row.
        */

        BREAK: 0x01,

        /**
        * Set sequence (pattern) position after current row.
        */

        SETPOSITION: 0x02,

        /**
        * Skip next row.
        */

        SKIP: 0x04
    }

    /**
     * Mapping effect numbers to effect processor functions. The protracker MOD
     * loader converts extra (Ex effects) to ID 1x so that the effect numbers
     * are contiguous.
     */

    static fxTable = {

        /**
         * Effects processed in the first tick of each row.
         */

        note: {
            0x08: ProtrackerPlayroutine.prototype.fxSetFinePanning,
            0x09: ProtrackerPlayroutine.prototype.fxSampleOffset,
            0x0b: ProtrackerPlayroutine.prototype.fxPositionJump,
            0x0c: ProtrackerPlayroutine.prototype.fxSetVolume,
            0x0d: ProtrackerPlayroutine.prototype.fxPatternBreak,
            0x0f: ProtrackerPlayroutine.prototype.fxSetSpeed,
            0x11: ProtrackerPlayroutine.prototype.fxPortamentoUp,
            0x12: ProtrackerPlayroutine.prototype.fxPortamentoDown,
            0x13: ProtrackerPlayroutine.prototype.fxGlissandoCtrl,
            0x14: ProtrackerPlayroutine.prototype.fxSetVibratoCtrl,
            0x15: ProtrackerPlayroutine.prototype.fxSetFinetune,
            0x16: ProtrackerPlayroutine.prototype.fxPatternLoop,
            0x17: ProtrackerPlayroutine.prototype.fxSetTremoloCtrl,
            0x18: ProtrackerPlayroutine.prototype.fxSetPanning,
            0x19: ProtrackerPlayroutine.prototype.fxRetrigNote,
            0x1a: ProtrackerPlayroutine.prototype.fxFineVolumeUp,
            0x1b: ProtrackerPlayroutine.prototype.fxFineVolumeDown,
            0x1c: ProtrackerPlayroutine.prototype.fxNoteCut,
            0x1d: ProtrackerPlayroutine.prototype.fxNoteDelay,
            0x1e: ProtrackerPlayroutine.prototype.fxPatternDelay
        },

        /**
         * Effects processed in subsequent ticks of each row.
         */

        intra: {
            0x00: ProtrackerPlayroutine.prototype.fxArpeggio,
            0x01: ProtrackerPlayroutine.prototype.fxPortamentoUp,
            0x02: ProtrackerPlayroutine.prototype.fxPortamentoDown,
            0x03: ProtrackerPlayroutine.prototype.fxTonePortamento,
            0x04: ProtrackerPlayroutine.prototype.fxVibrato,
            0x05: ProtrackerPlayroutine.prototype.fxToneVolumeSlide,
            0x06: ProtrackerPlayroutine.prototype.fxVibratoVolumeSlide,
            0x07: ProtrackerPlayroutine.prototype.fxTremolo,
            0x0a: ProtrackerPlayroutine.prototype.fxVolumeSlide,
            0x19: ProtrackerPlayroutine.prototype.fxRetrigNote,
            0x1c: ProtrackerPlayroutine.prototype.fxNoteCut,
            0x1d: ProtrackerPlayroutine.prototype.fxNoteDelay
        },

        /**
         * Effects processed during a pattern delay.
         */

        patternDelay: {
            0x00: ProtrackerPlayroutine.prototype.fxArpeggio,
            0x01: ProtrackerPlayroutine.prototype.fxPortamentoUp,
            0x02: ProtrackerPlayroutine.prototype.fxPortamentoDown,
            0x03: ProtrackerPlayroutine.prototype.fxTonePortamento,
            0x04: ProtrackerPlayroutine.prototype.fxVibrato,
            0x05: ProtrackerPlayroutine.prototype.fxToneVolumeSlide,
            0x06: ProtrackerPlayroutine.prototype.fxVibratoVolumeSlide,
            0x07: ProtrackerPlayroutine.prototype.fxTremolo,
            0x0a: ProtrackerPlayroutine.prototype.fxVolumeSlide,
            0x0b: ProtrackerPlayroutine.prototype.fxPositionJump,
            0x0d: ProtrackerPlayroutine.prototype.fxPatternBreak,
            0x11: ProtrackerPlayroutine.prototype.fxPortamentoUp,
            0x12: ProtrackerPlayroutine.prototype.fxPortamentoDown,
            0x1a: ProtrackerPlayroutine.prototype.fxFineVolumeUp,
            0x1b: ProtrackerPlayroutine.prototype.fxFineVolumeDown
        }
    }

    /**
     * Create a new instance of the playroutine.
     *
     * @param {object} wavetable
     *      Instance of the wavetable used for audio rendering.
     * @param {object} track
     *      Track as returned by the loadProtrackerMOD() function.
     */

    constructor(wavetable, track) {
        super(...arguments)
    }

    /**
     * Reset the playroutine as if it weren't playing the song before.
     */

    reset() {
        super.reset(...arguments)

        this.state = ProtrackerPlayroutine.STATE.INITIALIZED
        this.defaultPanWidth = 0
        this.region = "pal"
        this.baseClock = baseClocks[this.region] * 8
        this.tempoTimer = "cia"

        this.fxSetSpeed(125)            // Set initial BPM
        this.tickRate = this.nextTickRate
        this.fxSetSpeed(6)              // Set initial ticks/row
        this.restartPosition = 0        // Song restart position
        this.position = 0               // Current (pattern) sequence position
        this.row = 0                    // Current playing row
        this.tick = 0                   // Current tick
        this.pattern =                  // Current playing pattern
            this.track.patterns[this.track.sequence[this.position]]

        this.breakRow = 0               // Wanted row after break
        this.breakPosition = 0          // Wanted sequence position after break
        this.patternDelay = 0           // Wanted pattern delay
        this.patternDelayCount = 0      // Pattern delay counter
        this.loopStartRow = 0           // Start row of pattern loop
        this.loopCount = 0              // Pattern loop count

        this.sequenceFlags = 0             // Playback state flags

        // Initialize channels

        this.channels = []
        for (let i = 0; i < this.track.numChannels; i++) {
            this.channels[i] = {
                mixerFlags: 0,          // Mixer flags
                lastNote: null,         // Last played note
                note: null,             // Current pattern note
                volume: 0,              // Channel volume (0 - 64)
                playVolume: 0,          // Channel volume for playback (0 - 1)
                pan: 0,                 // Channel panning (-1 - 1)
                sampleIndex: -1,        // Channel sample number (-1 - 31)
                instrumentSample: null, // Current instrument sample
                finetune: 0,            // Channel finetune
                tonePortaDirection: 0,  // Tone portamento direction (0 or 1)
                tonePortaSpeed: 0,      // Tone portamento speed
                tonePortaPeriod: 0,     // Tone portamento wanted note period
                waveControl: 0,         // Waveform control flags
                vibratoPosition: 0,     // Vibrato waveform position (0 - 31)
                vibratoParam: 0,        // Vibrato command parameter
                tremoloPosition: 0,     // Tremolo waveform position (0 - 31)
                tremoloParam: 0,        // Tremolo command parameter
                glissandoFlag: 0,       // Enable (1) or disable (0) glissando
                sampleOffset: 0,        // Sample offset position
                samplePosition: 0,      // Sample playback start position
                period: 0,              // Note period
                playPeriod: 0           // Note period for playback
            }
        }
    }

    /**
     * Return current playroutine preferences.
     *
     * @returns {object}
     *      Playroutine parameters, see setParameters() for details.
     */

    getParameters() {
        return Object.assign(super.getParameters(...arguments), {
            region: this.region,
            defaultPanWidth: this.defaultPanWidth
        })
    }

    /**
     * Set playroutine preferences.
     *
     * @param {object} [options]
     *      Optional parameters for playback.
     * @param {string} [options.region="pal"]
     *      Amiga hardware region. Possible values are "pal" and "ntsc".
     * @param {number} [options.defaultPanWidth=0]
     *      Default pan width between 0 - 1. Value 0 sets panning of all
     *      channels to mono, value 1 sets all channels to far left/right as on
     *      the Amiga at the start of playback. Effects 8xx and E8x will
     *      override this default value during playback. This option can only be
     *      set before processTick() is called.
     * @param {string} [options.tempoTimer="cia"]
     *      Source of the tempo (BPM) timer for player ticks. "cia" simulates
     *      the Amiga CIA timer (including the 1-tick delay and region-dependent
     *      effective speeds), "accurate" uses real accurate timing (ie. a BPM
     *      of 125 results in a tick rate of exactly 50 Hz).
     */

    setParameters(options) {
        super.setParameters(...arguments)

        options = options || {}

        if ("region" in options && Object.keys(baseClocks).indexOf(options.region) >= 0) {
            this.region = options.region
            this.baseClock = baseClocks[options.region] * 8
            this.fxSetSpeed(this.bpm)
            this.tickRate = this.nextTickRate

            if (this.state === ProtrackerPlayroutine.STATE.RUNNING) {
                this.channels.forEach((channel, channelNr) =>
                    this.wavetable.setMixer(channelNr, Wavetable.MIXER.SPEED, {
                        sampleRate: this.baseClock / channel.playPeriod
                    })
                )
            }
        }

        if ("defaultPanWidth" in options) {
            this.defaultPanWidth = clamp(options.defaultPanWidth, 0, 1)

            if (this.state === ProtrackerPlayroutine.STATE.INITIALIZED) {
                this.channels.forEach((channel, channelNr) => {
                    channel.pan = amigaChannelPan(channelNr) * (this.defaultPanWidth || 0)
                    this.wavetable.setMixer(channelNr, Wavetable.MIXER.PAN, {
                        pan: channel.pan
                    })
                })
            }
        }

        if ("tempoTimer" in options && ["cia", "accurate"].indexOf(options.tempoTimer) >= 0) {
            this.tempoTimer = options.tempoTimer
            this.fxSetSpeed(this.bpm)
            this.tickRate = this.nextTickRate
        }
    }

    /**
     * Return current playroutine and wavetable channel status.
     *
     * @returns {object}
     *      Object with playroutine and wavetable channel status information.
     */

    getInfo() {
        const mixerChannels = this.wavetable.getMixerInfo()

        return {
            bpm: this.bpm,
            speed: this.speed,
            position: this.position,
            row: this.row,
            tick: this.tick,
            channels: this.channels.map((channel, channelNr) => {
                const mixerChannel = mixerChannels[channelNr]
                return {
                    volume: mixerChannel.volume,
                    pan: mixerChannel.pan,
                    sampleIndex: channel.sampleIndex,
                    samplePosition: mixerChannel.samplePosition,
                    sampleRate: mixerChannel.sampleRate,
                    speed: mixerChannel.speed
                }
            })
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

    setPosition(position, row, options) {
        options = options || {}

        // Calculate new position, return when exceeds track length

        let newPosition = options.relativePosition ? this.position + position : position
        if (newPosition >= this.track.sequence.length) {
            return
        }
        let newPattern = this.track.patterns[this.track.sequence[newPosition]]
        let newRow = options.relativeRow ? this.row + row : row
        if (newRow >= newPattern.rows.length) {
            newRow = 0
            newPosition++
        }
        if (newPosition >= this.track.sequence.length) {
            return
        }

        // Stop samples when necessary

        if (options.stopSamples) {
            this.channels.forEach((channel, channelNr) => {
                channel.sampleIndex = -1
                channel.instrumentSample = null
                this.wavetable.setMixer(channelNr, Wavetable.MIXER.SAMPLECHANGE, {
                    wavetableSample: null
                })
            })
        }

        // Adjust song position

        this.pattern = this.track.patterns[this.track.sequence[newPosition]]
        this.tick = 0
        this.row = newRow
        this.position = newPosition
    }

    /**
     * Process a playroutine tick. This must be called before rendering anything
     * of the song and after rendering samples for the amount of time returned
     * by this function.
     *
     * @returns {number}
     *      Number of seconds until the next playroutine tick (render the
     *      soundtrack samples for this amount of time, then call
     *      processTick() again).
     */

    processTick() {
        super.processTick(...arguments)

        this.state = ProtrackerPlayroutine.STATE.RUNNING

        // Speed = 0 -> stop song

        if (this.speed === 0) {
            const tickRate = this.tickRate
            this.tickRate = this.nextTickRate
            return tickRate
        }

        // Process each channel sequentially

        const notes = this.pattern.rows[this.row].notes
        this.channels.forEach((channel, channelNr) => {
            const note = notes[channelNr]
            channel.mixerFlags = 0
            channel.sampleFlags = 0

            if (this.tick === 0 && this.patternDelayCount === 0) {

                // First (main tick)

                channel.note = note

                // Handle presence of sample number

                if (note.sampleIndex >= 0) {
                    const sample = this.track.samples[note.sampleIndex]
                    const curSampleIndex = channel.sampleIndex

                    // Copy sample settings into channel state

                    channel.mixerFlags |= Wavetable.MIXER.SAMPLECHANGE | Wavetable.MIXER.VOLUME
                    channel.volume = channel.playVolume = clamp(sample.volume, 0, 64)
                    channel.finetune = clamp(sample.finetune, -8, 7)
                    channel.sampleIndex = clamp(note.sampleIndex, -1, 31)

                    // Instant sample change unless starting a tone portamento
                    // at the same time

                    if (!(curSampleIndex >= 0 && note.note >= 0 && note.fx === 0x03)) {
                        channel.instrumentSample = sample
                        if (note.fx !== 0x09) {
                            channel.sampleOffset = 0
                        }
                    }
                }

                // Handle presence of note/octave

                if (note.note >= 0) {
                    if (note.fx === 0x03 || note.fx === 0x05) {

                        // Tone portamento, save target period

                        const targetPeriod = notePeriod(note, channel.finetune)
                        const dir = targetPeriod - channel.period

                        if (dir !== 0 && channel.period > 0) {
                            channel.tonePortaPeriod = targetPeriod
                            channel.tonePortaDirection = dir > 0 ? 1 : -1
                        } else {
                            channel.tonePortaPeriod = 0
                        }
                    } else {
                        channel.lastNote = note

                        // Apply period

                        if (note.fx === 0x15) {
                            fxSetFinetune(note.fxParam)
                        }

                        channel.period = channel.playPeriod = notePeriod(note, channel.finetune)

                        if (note.fx !== 0x1d) {
                            if ((channel.waveControl & 0x04) === 0) {
                                channel.vibratoPosition = 0
                            }
                            if ((channel.waveControl & 0x40) === 0) {
                                channel.tremoloPosition = 0
                            }

                            channel.mixerFlags |= Wavetable.MIXER.SAMPLECHANGE | Wavetable.MIXER.SAMPLEPOSITION | Wavetable.MIXER.SPEED
                            channel.samplePosition = note.sampleIndex >= 0 ? 0 : channel.sampleOffset
                        }
                    }
                }

                // Process effects in first tick

                // Reset volume and period on each first tick (yes, this ruins
                // vibrato and tremolo, but that's how it works in ProTracker).
                // To prevent unnecessary mixer calls and the conversion from
                // period to playback speed, this will only be done if the
                // playback volume and period do not match the values from the
                // pattern note.

                if (channel.volume !== channel.playVolume) {
                    channel.playVolume = channel.volume
                    channel.mixerFlags |= Wavetable.MIXER.VOLUME
                }
                if (channel.period !== channel.playPeriod) {
                    channel.playPeriod = channel.period
                    channel.mixerFlags |= Wavetable.MIXER.SPEED
                }

                this.processFx("note", channel, note)

            } else if (this.tick === 0) {

                // Process effects during pattern delay

                this.processFx("patternDelay", channel, note)

            } else {

                // Process effects during subsequent player ticks

                this.processFx("intra", channel, note)
            }

            // Program the wavetable channel

            this.wavetable.setMixer(channelNr, channel.mixerFlags, {
                wavetableSample: (channel.instrumentSample || {}).wavetableSample,
                samplePosition: channel.samplePosition,
                volume: channel.playVolume / 64,
                pan: channel.pan,
                sampleRate: this.baseClock / channel.playPeriod
            })
        })

        // Playroutine tick complete, adjust to next one

        this.tick++
        if (this.tick >= this.speed) {

            // Next row

            this.tick = 0

            // Handle pattern delay

            if (this.patternDelay > 0) {
                this.patternDelayCount = this.patternDelay + 1
                this.patternDelay = 0
            }
            if (this.patternDelayCount > 0) {
                this.patternDelayCount--
            }

            if (this.patternDelayCount === 0) {
                if ((this.sequenceFlags & (ProtrackerPlayroutine.SEQUENCE.BREAK | ProtrackerPlayroutine.SEQUENCE.SETPOSITION)) === 0) {

                    // Advance to next row/pattern

                    this.nextRow()
                } else {

                    // Handle pattern break and/or position jump effects

                    let newPosition = this.position + 1
                    if (this.sequenceFlags & ProtrackerPlayroutine.SEQUENCE.SETPOSITION) {
                        newPosition = this.breakPosition
                        this.breakPosition = 0
                    }
                    if (newPosition >= this.track.sequence.length) {
                        newPosition = this.restartPosition
                    }

                    this.position = newPosition
                    this.pattern = this.track.patterns[this.track.sequence[this.position]]
                    this.row = this.breakRow
                    this.sequenceFlags &= ~(ProtrackerPlayroutine.SEQUENCE.BREAK | ProtrackerPlayroutine.SEQUENCE.SETPOSITION)

                    if (this.sequenceFlags & ProtrackerPlayroutine.SEQUENCE.SKIP) {
                        this.sequenceFlags &= ~ProtrackerPlayroutine.SEQUENCE.SKIP
                        this.nextRow()
                    }
                }
            }
        }

        // Return seconds until next tick

        const tickRate = this.tickRate
        this.tickRate = this.nextTickRate
        return tickRate
    }

    /**
     * Adjust playback to the next pattern row.
     *
     * @private
     */

    nextRow() {
        this.row++
        if (this.row >= this.pattern.rows.length) {
            this.row = 0
            this.position++
            if (this.position >= this.track.sequence.length) {
                this.position = this.restartPosition
            }
            this.pattern = this.track.patterns[this.track.sequence[this.position]]
        }
    }

    /**
     * Process effect in a channel.
     *
     * @private
     * @param {string} type
     *      Key to the effect table in fxTable.
     * @param {object} channel
     *      Player channel object.
     * @param {object} note
     *      Pattern note object.
     */

    processFx(type, channel, note) {
        if (note.fx === 0 && note.fxParam === 0) {
            return
        }

        const fxFn = ProtrackerPlayroutine.fxTable[type][note.fx]

        if (fxFn) {
            fxFn.call(this, note.fxParam, channel)
        }
    }

    /**
     * Effect 0xy - Arpeggio
     * Change pitch to wanted note, then x, then y halfnotes higher on each tick.
     *
     * @private
     * @param {number} param
     *      Effect parameter.
     * @param {object} channel
     *      Playroutine channel object.
     */

    fxArpeggio(param, channel) {
        if (channel.lastNote === null || channel.lastNote.note < 0) {
            return
        }

        const phase = this.tick %3

        let newNote = channel.lastNote.note
        if (phase === 1) {
            newNote += param >> 4
        } else if (phase === 2) {
            newNote += (param & 0x0f)
        }
        const newOctave = channel.lastNote.octave + Math.floor(newNote / 12)
        newNote = newNote % 12

        channel.playPeriod = notePeriod({
            note: newNote,
            octave: newOctave
        }, channel.finetune)
        channel.mixerFlags |= Wavetable.MIXER.SPEED
    }

    /**
     * Effect 1xx - Portamento up
     * Increase current note pitch by decreasing Amiga MOD period by xx units.
     *
     * @private
     * @param {number} param
     *      Effect parameter.
     * @param {object} channel
     *      Playroutine channel object.
     */

    fxPortamentoUp(param, channel) {
        const periodDiff = period(param)
        let newPeriod = clamp(channel.period - periodDiff, period(113), Infinity)

        channel.period = channel.playPeriod = newPeriod
        channel.mixerFlags |= Wavetable.MIXER.SPEED
    }

    /**
     * Effect 2xx - Portamento down
     * Decrease current note pitch by increasing Amiga MOD period by xx units.
     *
     * @private
     * @param {number} param
     *      Effect parameter.
     * @param {object} channel
     *      Playroutine channel object.
     */

    fxPortamentoDown(param, channel) {
        const periodDiff = period(param)
        let newPeriod = clamp(channel.period + periodDiff, 0, period(856))

        channel.period = channel.playPeriod = newPeriod
        channel.mixerFlags |= Wavetable.MIXER.SPEED
    }

    /**
     * Effect 3xx - Tone portamento
     * Slide the pitch of the current note towards the note in the current pattern row
     * by xx Amiga MOD periods. If xx is zero, the previously specified value is used.
     *
     * @private
     * @param {number} param
     *      Effect parameter.
     * @param {object} channel
     *      Playroutine channel object.
     */

    fxTonePortamento(param, channel) {
        if (param !== 0) {
            channel.tonePortaSpeed = param
        }
        if (channel.tonePortaPeriod === 0) {
            return
        }

        let newPeriod = channel.period + (period(channel.tonePortaSpeed) * channel.tonePortaDirection)
        if (
            (channel.tonePortaDirection > 0 && newPeriod > channel.tonePortaPeriod) ||
            (channel.tonePortaDirection < 0 && newPeriod < channel.tonePortaPeriod)
        ) {
            channel.period = channel.playPeriod = channel.tonePortaPeriod
            channel.tonePortaPeriod = 0
        } else {
            channel.period = newPeriod
            if (channel.glissandoFlag > 0) {
                newPeriod = floorPeriod(newPeriod, channel.finetune)
            }
            channel.playPeriod = newPeriod
        }
        channel.mixerFlags |= Wavetable.MIXER.SPEED
    }

    /**
     * Effect 4xy - Vibrato
     * Apply vibrato with speed x and depth y on current note. Only alters the playback speed,
     * does not change the stored pitch (period) for the channel. If either x or y is zero,
     * previously used values are applied.
     *
     * @private
     * @param {number} param
     *      Effect parameter.
     * @param {object} channel
     *      Playroutine channel object.
     */

    fxVibrato(param, channel) {
        if ((param & 0x0f) === 0) {
            param |= (channel.vibratoParam & 0x0f)
        }
        if ((param & 0xf0) === 0) {
            param |= (channel.vibratoParam & 0xf0)
        }
        channel.vibratoParam = param

        let vibratoPosition = (channel.vibratoPosition >> 2) & 0x1f
        let vibratoMultiplier = 255
        switch (channel.waveControl & 0x03) {
            case 0x00: // Sine wave
                vibratoMultiplier = vibratoSineTab[vibratoPosition]
                break
            case 0x01: // Sawtooth
                vibratoMultiplier = channel.vibratoPosition < 0x80 ?
                    (vibratoPosition << 3) : (255 - (vibratoPosition << 3))
                break
        }

        const vibratoDepth = param & 0x0f
        channel.playPeriod = channel.period + period((vibratoMultiplier * vibratoDepth) >> 7) * (
            channel.vibratoPosition < 0x80 ? 1 : -1 // Invert direction after half cycle
        )
        channel.mixerFlags |= Wavetable.MIXER.SPEED
        channel.vibratoPosition = ((channel.vibratoPosition + ((param >> 2) & 0x3c)) & 0xff)
    }

    /**
     * Effect 5xy - Volume slide with tone portamento
     * Apply volume slide with given xy parameters and continue portamento with
     * previously used tone portamento effect parameters (same as Axy with 300).
     *
     * @private
     * @param {number} param
     *      Effect parameter.
     * @param {object} channel
     *      Playroutine channel object.
     */

    fxToneVolumeSlide(param, channel) {
        this.fxTonePortamento(0, channel)
        this.fxVolumeSlide(param, channel)
    }

    /**
     * Effect 6xy - Volume slide with vibrato
     * Apply volume slide with given xy parameters and continue vibrato with
     * previously used vibrato speed and depth parameters (same as Axy with 400).
     *
     * @private
     * @param {number} param
     *      Effect parameter.
     * @param {object} channel
     *      Playroutine channel object.
     */

    fxVibratoVolumeSlide(param, channel) {
        this.fxVibrato(0, channel)
        this.fxVolumeSlide(param, channel)
    }

    /**
     * Effect 7xy - Tremolo
     * Apply tremolo with speed x and depth y on current note. Only alters the playback volume,
     * does not change the stored volume for the channel. If either x or y is zero, previously
     * used values are applied.
     *
     * @private
     * @param {number} param
     *      Effect parameter.
     * @param {object} channel
     *      Playroutine channel object.
     */

    fxTremolo(param, channel) {
        if ((param & 0x0f) === 0) {
            param |= (channel.tremoloParam & 0x0f)
        }
        if ((param & 0xf0) === 0) {
            param |= (channel.tremoloParam & 0xf0)
        }
        channel.tremoloParam = param

        let tremoloMultiplier = 255
        switch (channel.waveControl & 0x30) {
            case 0x00: // Sine wave
                tremoloMultiplier = vibratoSineTab[(channel.tremoloPosition >> 2) & 0x1f]
                break
            case 0x10: // Sawtooth
                tremoloMultiplier = channel.vibratoPosition < 0x80 ?
                    //                      ^^^
                    // Yes, this is a copy-paste monster from ProTracker. They forgot to
                    // update the variable name. This should be channel.tremoloPosition.
                    (((channel.tremoloPosition >> 2) & 0x1f) << 3) :
                    (255 - (((channel.tremoloPosition >> 2) & 0x1f) << 3))
                break
        }

        const tremoloDepth = param & 0x0f
        channel.playVolume = clamp(channel.volume + (Math.floor((tremoloDepth * tremoloMultiplier / 128) * (
            channel.tremoloPosition < 0x80 ? 1 : -1 // Invert direction after half cycle
        )) >> 6), 0, 64)
        channel.mixerFlags |= Wavetable.MIXER.VOLUME
        channel.tremoloPosition = ((channel.tremoloPosition + ((param >> 2) & 0x3c)) & 0xff)
    }

    /**
     * Effect 8xx - Set fine panning
     * Set the panning of the channel to xx, where 00 is far left and FF is far right.
     *
     * @private
     * @param {number} param
     *      Effect parameter.
     * @param {object} channel
     *      Playroutine channel object.
     */

    fxSetFinePanning(param, channel) {
        channel.pan = (param - 127.5) / 127.5
        channel.mixerFlags |= Wavetable.MIXER.PAN
    }

    /**
     * Effect 9xx - Sample offset
     * Play the instrument from the xxth * 256 sample offset.
     *
     * @private
     * @param {number} param
     *      Effect parameter.
     * @param {object} channel
     *      Playroutine channel object.
     */

    fxSampleOffset(param, channel) {
        if (param === 0) {
            channel.samplePosition = channel.sampleOffset
        } else {
            channel.samplePosition = channel.sampleOffset = (param << 8)
        }
    }

    /**
     * Effect Axy - Volume slide
     * Slide the volume up or down. y decreases and x increases the volume. When
     * both are present, x (slide volume down) takes precedence.
     *
     * @private
     * @param {number} param
     *      Effect parameter.
     * @param {object} channel
     *      Playroutine channel object.
     */

    fxVolumeSlide(param, channel) {
        const volumeDiff = (param & 0x0f) ? -(param & 0x0f) : (param >> 4)
        channel.volume = channel.playVolume = clamp(channel.volume + volumeDiff, 0, 64)
        channel.mixerFlags |= Wavetable.MIXER.VOLUME
    }

    /**
     * Effect Bxx - Position jump
     * Jump to the first row of the pattern specified in position xx. If the pattern
     * break effect is present in a following channel, the row number specified in
     * the Dxx command will be used as the target.
     *
     * @private
     * @param {number} param
     *      Effect parameter.
     */

    fxPositionJump(param) {
        this.breakPosition = param
        this.breakRow = 0
        this.sequenceFlags |= ProtrackerPlayroutine.SEQUENCE.BREAK | ProtrackerPlayroutine.SEQUENCE.SETPOSITION
    }

    /**
     * Effect Cxx - Set volume
     * Set the volume of the channel to xx.
     *
     * @private
     * @param {number} param
     *      Effect parameter.
     * @param {object} channel
     *      Playroutine channel object.
     */

    fxSetVolume(param, channel) {
        channel.volume = channel.playVolume = clamp(param, 0, 64)
        channel.mixerFlags |= Wavetable.MIXER.VOLUME
    }

    /**
     * Effect Dxx - Pattern break
     * Jump to row xx of the next pattern in the sequence. Parameter xx is a weirdo
     * BCD-like value, the upper nibble is treated as 10-base but the lower is added
     * as hexadecimal. For example xx = 32 jumps to row 32 and xx = 1f jumps to row
     * 25 (10 + 15). If a following channel has Bxx effect, the target row is reset
     * to 0.
     *
     * @private
     * @param {number} param
     *      Effect parameter.
     */

    fxPatternBreak(param) {
        let row = (param >> 4) * 10 + (param & 0x0f)

        if (row > 63) {
            row = 0
        }

        this.breakRow = row
        this.sequenceFlags |= ProtrackerPlayroutine.SEQUENCE.BREAK
        if (this.patternDelayCount > 0) {
            this.sequenceFlags |= ProtrackerPlayroutine.SEQUENCE.SKIP
        }
    }

    /**
     * Effect Fxx - Set speed/tempo (BPM)
     * Set the speed (ticks per row) if xx < 20 (hex) or tempo (BPM) if xx >= 20.
     *
     * @private
     * @param {number} param
     *      Effect parameter.
     */

    fxSetSpeed(speed) {
        if (speed >= 32) {
            this.bpm = speed
            if (this.tempoTimer === "accurate") {
                this.tickRate = this.nextTickRate = (125 / speed) * .02
            } else {
                const ciaPeriod = Math.floor((this.region === "pal" ? 1773447 : 1789773) / speed)
                //                                                    ^^^^^^^   ^^^^^^^
                // These should be actually this.baseClock / 32, but Protracker
                // uses hardcoded values where PAL is rounded down and NTSC is
                // rounded up. For better accuracy we just use Protracker
                // constants for calculation.
                this.nextTickRate = 1 / ((this.baseClock / 80) / (ciaPeriod + 1))
            }
        } else {
            this.speed = speed
        }
    }

     /**
     * Effect E3x - Glissando control
     * Controls whether tone portamento performs slides in semitones or not.
     * x = 0: Disable glissando (default slide)
     * x > 0: Enable glissando (slide by semitones)
     *
     * @private
     * @param {number} param
     *      Effect parameter.
     * @param {object} channel
     *      Playroutine channel object.
     */

    fxGlissandoCtrl(param, channel) {
        channel.glissandoFlag = param
    }

    /**
     * E4x - Set vibrato waveform
     * x = 0: sine (default)
     * x = 1: sawtooth
     * x = 2: square
     * The waveforms restart if a note is specified. Add 4 to ignore the note. Then
     * the waveforms will continue through the new note.
     *
     * @private
     * @param {number} param
     *      Effect parameter.
     * @param {object} channel
     *      Playroutine channel object.
     */

    fxSetVibratoCtrl(param, channel) {
        channel.waveControl = (channel.waveControl & 0xf0) | param
    }

    /**
     * E5x - Set finetune
     * Set finetune. Applies to current playing note only, does not change the
     * sample preset finetune value.
     *
     * @private
     * @param {number} param
     *      Effect parameter.
     * @param {object} channel
     *      Playroutine channel object.
     */

    fxSetFinetune(param, channel) {
        channel.finetune = param
        if (channel.finetune >= 8) {
            channel.finetune -= 16
        }
    }

    /**
     * E6x - Pattern loop
     * Set loop start position within pattern if x = 0, repeat pattern between
     * start position and end of current row x times if x > 0.
     *
     * @private
     * @param {number} param
     *      Effect parameter.
     */

    fxPatternLoop(param) {
        if (param === 0) {
            this.loopStartRow = this.row
            return
        }

        if (this.loopCount === 0) {
            this.loopCount = param
        } else {
            this.loopCount--
            if (this.loopCount === 0) {
                return
            }
        }

        this.breakRow = this.loopStartRow
        this.breakPosition = this.position
        this.sequenceFlags |= ProtrackerPlayroutine.SEQUENCE.SETPOSITION | ProtrackerPlayroutine.SEQUENCE.BREAK
    }

    /**
     * E7x - Set tremolo waveform
     * x = 0: sine (default)
     * x = 1: sawtooth
     * x = 2: square
     * The waveforms restart if a note is specified. Add 4 to ignore the note. Then
     * the waveforms will continue through the new note.
     *
     * @private
     * @param {number} param
     *      Effect parameter.
     * @param {object} channel
     *      Playroutine channel object.
     */

    fxSetTremoloCtrl(param, channel) {
        channel.waveControl = (channel.waveControl & 0x0f) | (param << 4)
    }

    /**
     * E8x - Set panning
     * Set the panning of the channel to x, where 0 is far left and F is far right.
     *
     * @private
     * @param {number} param
     *      Effect parameter.
     * @param {object} channel
     *      Playroutine channel object.
     */

    fxSetPanning(param, channel) {
        channel.pan = param / 7.5 - 1
        channel.mixerFlags |= Wavetable.MIXER.PAN
    }

    /**
     * E9x - Retrigger note
     * Reset sample position every x ticks.
     *
     * @private
     * @param {number} param
     *      Effect parameter.
     * @param {object} channel
     *      Playroutine channel object.
     */

    fxRetrigNote(param, channel) {
        if (param === 0) {
            return
        }

        if (this.tick % param > 0) {
            return
        }

        channel.samplePosition = 0
        channel.playPeriod = channel.period
        channel.mixerFlags |= Wavetable.MIXER.SAMPLEPOSITION | Wavetable.MIXER.SPEED
    }

    /**
     * EAx - Fine volume slide up
     * Slide volume up by x.
     *
     * @private
     * @param {number} param
     *      Effect parameter.
     * @param {object} channel
     *      Playroutine channel object.
     */

    fxFineVolumeUp(param, channel) {
        channel.volume = channel.playVolume = clamp(channel.volume + param, 0, 64)
        channel.mixerFlags |= Wavetable.MIXER.VOLUME
    }

    /**
     * EBx - Fine volume slide down
     * Slide volume down by x.
     *
     * @private
     * @param {number} param
     *      Effect parameter.
     * @param {object} channel
     *      Playroutine channel object.
     */

    fxFineVolumeDown(param, channel) {
        channel.volume = channel.playVolume = clamp(channel.volume - param, 0, 64)
        channel.mixerFlags |= Wavetable.MIXER.VOLUME
    }

    /**
     * ECx - Note cut
     * Set the volume of the channel to 0 after x ticks.
     *
     * @private
     * @param {number} param
     *      Effect parameter.
     * @param {object} channel
     *      Playroutine channel object.
     */

    fxNoteCut(param, channel) {
        if (this.tick !== param) {
            return
        }

        channel.volume = channel.playVolume = 0
        channel.mixerFlags |= Wavetable.MIXER.VOLUME
    }

    /**
     * EDx - Note delay
     * Delay start of the sample for x ticks.
     *
     * @private
     * @param {number} param
     *      Effect parameter.
     * @param {object} channel
     *      Playroutine channel object.
     */

    fxNoteDelay(param, channel) {
        if (this.tick !== param || channel.note.note < 0) {
            return
        }

        channel.samplePosition = 0
        channel.playPeriod = channel.period
        channel.mixerFlags |= Wavetable.MIXER.SAMPLEPOSITION | Wavetable.MIXER.SPEED
    }

    /**
     * EEx - Pattern delay
     * Repeat the current row x times without retriggering notes.
     *
     * @private
     * @param {number} param
     *      Effect parameter.
     */

    fxPatternDelay(param) {
        this.patternDelay = param
    }
}