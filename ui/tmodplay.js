import { SoftwareRendererDevice } from "../mod/dev_sw.js"
import { Player } from "../mod/player.js"

/**
 * Strings displayed on the UI.
 */

const strings = {
    appTitle: "Therapy MOD player",
    header: {
        position: "pos: {sequence}.{row}",
        stopped: "stopped",
        noSong: "Drop or open a MOD file",
        loadError: "Incompatible file",
        samples: "Samples / song message",
        help: "Press F1 for help"
    },
    controls: {
        openFile: "Open MOD file",
        play: "Play song",
        stop: "Stop song",
        help: "Open help"
    },
    stereoMode: {
        select: "Stereo mode",
        crossfeed: "Amiga hard pan crossfeed",
        crossfeedInfo: ", crossfeed: {crossfeed}%",
        auto: "Automatic",
        autoSelect: " (auto)",
        mono: "Mono",
        amiga: "Amiga hard pan",
        stereo: "Real stereo"
    },
    interpolation: {
        select: "Interpolation method",
        andAmplify: "{amplification}× amplify, {method} interpolation",
        auto: "Automatic",
        autoSelect: " (auto)",
        nearest: "nearest neighbor",
        blep: "Amiga",
        linear: "linear",
        watte: "Watte trilinear"
    },
    tempoTimer: {
        select: "Tempo timing",
        auto: "Automatic",
        cia: "Amiga timer",
        accurate: "Accurate BPM"
    },
    amplification: "Amplification",
    defaultPanWidth: "Default pan width for real stereo",
    region: {
        select: "Region",
        pal: "PAL",
        ntsc: "NTSC"
    },
    preferences: "Preferences",
    closeDialog: "Close dialog",
    resetPreferences: "Reset to defaults",
    renderer: {
        SoftwareRendererDevice: "Software renderer",
        sampleRate: " at {sampleRate} Hz"
    },
    numChannels: ["No song loaded", "1 channel", "{numChannels} channels"]
}

/**
 * Object mapping renderer stereo modes to display strings.
 */

const stereoModeStrings = {}
stereoModeStrings[SoftwareRendererDevice.STEREOMODE.MONO] = strings.stereoMode.mono
stereoModeStrings[SoftwareRendererDevice.STEREOMODE.AMIGA] = strings.stereoMode.amiga
stereoModeStrings[SoftwareRendererDevice.STEREOMODE.STEREO] = strings.stereoMode.stereo

/**
 * Object mapping renderer interpolation methods to display strings.
 */

const interpolationMethodStrings = {}
interpolationMethodStrings[SoftwareRendererDevice.INTERPOLATION.NEAREST] = strings.interpolation.nearest
interpolationMethodStrings[SoftwareRendererDevice.INTERPOLATION.BLEP] = strings.interpolation.blep
interpolationMethodStrings[SoftwareRendererDevice.INTERPOLATION.LINEAR] = strings.interpolation.linear
interpolationMethodStrings[SoftwareRendererDevice.INTERPOLATION.WATTE] = strings.interpolation.watte

/**
 * Number of samples included in the calculation of momentary RMS value.
 */

const rmsWindow = 256

/**
 * RMS range from which the RMS bar is displayed in logarithmic scale on the UI.
 * RMS values below this are displayed on a linear scale. -15 dB is about right
 * visually that feels close to the perceived volume.
 */

const rmsLogLimitdB = -15

/**
 * Scaling factor applied to the RMS bar's calculated value on the UI.
 */

const rmsBarScaleRatio = .6

/**
 * Color constants for scope canvas rendering.
 */

const cssBgColor = "rgb(0, 0, 0)"
const cssScopeLineColor = "rgba(48, 240, 88, .5)"
const cssScopeLimitColor = "rgb(20, 55, 24)"
const cssScopeColor = "rgb(48, 240, 88)"
const cssScopeLimitCrossColor = "rgb(252, 96, 52)"

/**
 * Digits used for hexadecimal presentation of numbers.
 */

const hexDigits = "0123456789ABCDEF"

/**
 * Replace tokens in curly braces (e.g. {media}) in a string with values
 * provided in an object. Applied from
 * {@link https://javascript.crockford.com/remedial.html}.
 *
 * @param {string} string
 *      String to transform.
 * @param {object} [data]
 *      Object used to retrieve values for the tokens in the string. If a
 *      token has no matching object property, the token itself will be kept
 *      without the curly braces. Token values must be either string or
 *      number, except when vnodes option is true.
 * @returns {string}
 *      Transformed string.
 */

function supplant(string, data) {
    return string.replace(/\{([^{}]*)\}/g, (match, property) => {
        const value = data[property]
        const type = typeof value

        return type === 'string' || type === 'number' ? value : match
    })
}

/**
 * Javascript implementation of
 * {@link https://github.com/a11599/tmodplay Therapy MOD Player}.
 */

class TMODPlay {
    constructor() {

        /**
         * Renderer device instance.
         */

        this.renderer = new SoftwareRendererDevice(48000)

        /**
         * MOD player instance.
         */

        this.player = new Player(this.renderer)

        /**
         * True when the MOD player instance is initialized and ready to play
         * the song.
         */

        this.playerInitialized = false

        /**
         * True if a song is being played.
         */

        this.playing = false

        /**
         * True if playback is being started or stopped. Used to ignore related
         * events during this period.
         */

        this.playStateChanging = false

        /**
         * The currently loaded MOD file.
         */

        this.song = null

        /**
         * Name of the currently loaded MOD file.
         */

        this.songFilename = ""

        /**
         * ID of the periodic (vsync) UI update callback handler.
         */

        this.vsyncHandler = null

        /**
         * Sample RMS ratios from previous periodic UI update. Used to smooth
         * the decay of RMS bars.
         */

        this.prevSampleRMSRatio = {}

        /**
         * Popup window displaying the user guide.
         */

        this.helpWindow = null

        /**
         * True when the preferences dialog is currently open.
         */

        this.preferencesDialogOpen = false

        /**
         * True when a keypress is being processed. Used to ignore keyboard
         * events while a previous keypress has not yet been processed.
         */

        this.keypressProcessing = false

        /**
         * Value of performance.now() at the last vertical sync.
         */

        this.lastVSyncTime = 0

        try {

            /**
             * Application preferences. Stored in localStorage. The parameters
             * property contains MOD player parameters.
             */

            this.preferences = JSON.parse(localStorage.getItem("preferences"))
        } catch(e) {}
        this.setDefaultPreferences()
    }

    /**
     * Application entry point.
     */

    async main() {

        // Initialize UI

        this.container = document.querySelector(".main")
        this.initUI()
    }

    /**
     * Try to setup the MOD player instance. This may fail silently (no errors
     * thrown) when it's not initiated from a user gesture. For instance,
     * Firefox does not consider a "drop" event a user gesture, while Chromium
     * does. As a consequence, the user needs to explicitly start playback via
     * clicking the play button or pressing space after a file has been dropped.
     */

    async setupPlayer() {
        if (!this.playerInitialized) {
            await this.player.setup()
            this.playerInitialized = true
        }
    }

    /**
     * Set default preference values.
     */

    setDefaultPreferences() {
        this.preferences = this.preferences || {}

        if (!("autoStereoMode" in this.preferences)) {
            this.preferences.autoStereoMode = true
        }
        if (!("autoInterpolation" in this.preferences)) {
            this.preferences.autoInterpolation = true
        }
        if (!("autoTempoTimer" in this.preferences)) {
            this.preferences.autoTempoTimer = true
        }

        this.preferences.parameters = this.preferences.parameters || {}
        const params = this.preferences.parameters
        if (!("region" in params)) {
            params.region = "pal"
        }
        if (!("defaultPanWidth" in params)) {
            params.defaultPanWidth = 0
        }
        if (!("amigaCrossfeed" in params)) {
            params.amigaCrossfeed = .75
        }
        if (!("amplification" in params)) {
            params.amplification = 1
        }
        if (!("interpolation" in params)) {
            params.interpolation = SoftwareRendererDevice.INTERPOLATION.LINEAR
        }
        if (!("stereoMode" in params)) {
            params.stereoMode = SoftwareRendererDevice.STEREOMODE.STEREO
        }
        if (!("tempoTimer" in params)) {
            params.tempoTimer = "cia"
        }
    }

    /**
     * Load a MOD file into the MOD player.
     *
     * @param {File} file
     *      A File object instance to load. The "song" property will contain the
     *      parsed MOD file.
     */

    async loadMOD(file) {
        const reader = new FileReader()
        return new Promise(async(resolve, reject) => {
            reader.addEventListener("load", async() => {
                try {
                    await this.stop()

                    try {
                        this.song = await this.player.load(reader.result)
                        this.songFilename = file.name
                    } catch(e) {
                        console.error(e)
                        this.song = null
                        this.songFilename = strings.header.loadError
                    }

                    // Pick automatic interpolation, stereo mode and tempo timer
                    // based on song features

                    if (this.preferences.autoInterpolation) {
                        this.preferences.parameters.interpolation = this.getAutoInterpolation()
                    }
                    if (this.preferences.autoStereoMode) {
                        this.preferences.parameters.stereoMode = this.getAutoStereoMode()
                    }
                    if (this.preferences.autoTempoTimer) {
                        this.preferences.parameters.tempoTimer = this.getAutoTempoTimer()
                    }
                    this.updatePreferences()

                    // Update UI, show play button

                    this.updateUISongProperties()
                    document.getElementById("button_play").classList.remove("info__control--hide")
                    resolve()
                } catch(e) {
                    reject(e)
                }
            })
            reader.readAsArrayBuffer(file)
        })
    }

    /**
     * Start MOD file playback. This must be called from a user gesture!
     */

    async play() {
        if (!this.song) {
            return
        }

        // Start playback, attempt player setup in case it has not been
        // initialized before

        await this.setupPlayer()
        await this.player.setParameters(this.preferences.parameters)
        const playing = this.player.play()
        Object.assign(this.preferences.parameters, await this.player.getParameters())
        this.updatePreferences()
        await playing
        this.playing = true

        // Change play button to stop

        const playButton = document.getElementById("button_play")
        playButton.classList.remove("info__control--play")
        playButton.classList.add("info__control--stop")
        playButton.textContent = strings.controls.stop
        playButton.title = strings.controls.stop

        // Start periodic UI updates on each vsync

        this.updateUIVSync(true)
    }

    /**
     * Start MOD file playback.
     */

    async stop() {
        if (!this.playing) {
            return
        }

        await this.player.stop()
        this.playing = false

        // Change stop button to play

        const playButton = document.getElementById("button_play")
        playButton.classList.remove("info__control--stop")
        playButton.classList.add("info__control--play")
        playButton.textContent = strings.controls.play
        playButton.title = strings.controls.play
    }

    /**
     * Calculate interpolation method based on current song features.
     *
     * @returns {number}
     *      Interpolation method best suited for the song.
     */

    getAutoInterpolation() {
        if (!this.song) {
            return SoftwareRendererDevice.INTERPOLATION.LINEAR
        }

        return this.song.numChannels > 4 || this.song.features.nonStandardNotes || this.song.features.panCommands ?
            SoftwareRendererDevice.INTERPOLATION.LINEAR :
            SoftwareRendererDevice.INTERPOLATION.BLEP
    }

    /**
     * Calculate stereo mixing mode based on current song features.
     *
     * @returns {number}
     *      Stereo mixing mode best suited for the song.
     */

    getAutoStereoMode() {
        if (!this.song) {
            return SoftwareRendererDevice.STEREOMODE.STEREO
        }

        return this.song.features.panCommands ?
            SoftwareRendererDevice.STEREOMODE.STEREO :
            SoftwareRendererDevice.STEREOMODE.AMIGA
    }

    /**
     * Calculate tempo timer setting based on current song features.
     *
     * @returns {number}
     *      Tempo timer setting best suited for the song.
     */

    getAutoTempoTimer() {
        if (!this.song) {
            return "accurate"
        }

        return this.song.numChannels > 4 || this.song.features.nonStandardNotes || this.song.features.panCommands ?
            "accurate" : "cia"
    }

    /**
     * Apply a preference setting.
     *
     * @param {object} options
     *      Preference parameters to apply.
     */

    async setPreference(options) {
        const preferences = structuredClone(options)
        if (preferences.parameters) {
            Object.assign(this.preferences.parameters, preferences.parameters)
            await this.player.setParameters(this.preferences.parameters)
            Object.assign(this.preferences.parameters, await this.player.getParameters())
            delete preferences.parameters
        }
        Object.assign(this.preferences, preferences)
        this.updatePreferences()
    }

    /**
     * Update preferences in localStorage and on the UI.
     */

    updatePreferences() {
        localStorage.setItem("preferences", JSON.stringify(this.preferences))
        this.updateUIPreferences()
    }

    /**
     * Initialize the UI.
     */

    initUI() {
        this.initUILayout()
        this.initUIScopes()
        this.initUIEvents()
        this.initUIPreferencesDialog()
        this.updateUIProgress()
        this.updateUIPreferences()
    }

    /**
     * Create UI layout.
     */

    initUILayout() {
        document.getElementById("loading").remove()

        document.title = strings.appTitle

        // Add header and progress bar

        const header = document.createElement("div")
        header.className = "nowplaying"
        header.innerHTML = `
            <header class="header">
                <div class="content">
                    <div id="song_position" class="content__part content__part--three-pane content__part--no-wrap"></div>
                    <div id="song_title" class="content__part content__part--three-pane content__part--no-wrap content__part--grow text--center text--primary">${strings.header.noSong}</div>
                    <div id="elapsed_time" class="content__part content__part--three-pane content__part--no-wrap text--right">0:00</div>
                </div>
            </header>
            <section class="progress">
                <div id="progress_bar" class="progress__bar">
                    <div id="progress_ratio" class="progress__elapsed"></div>
                </div>
            </section>
        `
        this.container.appendChild(header)

        // Add scopes and song/renderer info

        const scopes = document.createElement("section")
        scopes.className = "scopes"
        scopes.innerHTML = `
            <div class="content">
                <a href="#" class="content__part content__part--two-pane content__part--no-wrap content__part--grow scopes__link">
                    <div id="stereo_mode"></div>
                    <div id="interpolation"></div>
                </a>
                <div class="content__part content__part--two-pane content__part--no-wrap content__part--grow text--right">
                    <div id="num_channels">${strings.numChannels[0]}</div>
                    <div id="renderer"></div>
                </div>
            </div>
            <div class="content scopes__vis"><canvas id="scopes"></canvas></div>
        `
        this.container.appendChild(scopes)

        // Add info panel

        const info = document.createElement("section")
        info.className = "info"
        info.innerHTML = `
            <div class="content content--fit">
                <div class="info__samples content__part">
                    <div class="info__sample info__sample--padding">
                        <div class="info__samplename">` + [...Array(22).keys()].map(i => `&nbsp;`).join("") + `</div>
                        <div class="info__sampleheader">${strings.header.samples}</div>
                    </div>
                    ` + [...Array(16).keys()].map(i => `
                        <div class="info__sample"><div class="info__samplenr">${i + 1}</div><div class="info__samplename" id="sample_${i}">&nbsp;</div><div class="info__samplevu" id="sample_vu_${i}"></div></div>
                    `).join("") + `
                </div>
                <div class="info__controls">
                    <button class="info__control info__control--help" id="button_help" title="${strings.controls.help}">${strings.controls.help}</button>
                    <input type="file" class="info__controlfile" accept=".mod" id="filepicker">
                    <label for="filepicker" class="info__control info__control--eject" id="button_open" title="${strings.controls.openFile}">${strings.controls.openFile}</label>
                    <button class="info__control info__control--play info__control--hide" id="button_play" title="${strings.controls.play}">${strings.controls.play}</button>
                </div>
                <div class="info__samples">
                    <div class="info__sample info__sample--padding">
                        <div class="info__samplename">` + [...Array(22).keys()].map(i => `&nbsp;`).join("") + `</div>
                        <div class="info__sampleheader"><a class="info__link" id="help_link" href="#">${strings.header.help}</a></div>
                    </div>
                    ` + [...Array(15).keys()].map(i => `
                        <div class="info__sample"><div class="info__samplenr">${i + 17}</div><div class="info__samplename" id="sample_${i + 16}">&nbsp;</div><div class="info__samplevu" id="sample_vu_${i + 16}"></div></div>
                    `).join("") + `
                </div>
            </div>
        `
        this.container.appendChild(info)

        // Add preferences dialog

        this.preferencesDialog = document.createElement("div")
        this.preferencesDialog.className = "dialog__freeze"
        this.preferencesDialog.innerHTML = `
            <div class="dialog">
                <div class="dialog__header">
                    <h1 class="dialog__title">${strings.preferences}</h1>
                    <button class="dialog__close">${strings.closeDialog}</button>
                </div>
                <div class="dialog__split"><div class="dialog__splitpart">
                    <h2 class="dialog__formsection">${strings.interpolation.select}</h2>
                    <div class="dialog__formfield">
                        <input class="dialog__formcontrol" id="pref_interpolation_auto" type="radio" name="pref_interpolation" value="auto">
                        <label class="dialog__formlabel" for="pref_interpolation_auto">${strings.interpolation.auto}</label>
                    </div>
                    ` + Object.values(SoftwareRendererDevice.INTERPOLATION).map(method => `
                    <div class="dialog__formfield">
                        <input class="dialog__formcontrol" id="pref_interpolation_${method}" type="radio" name="pref_interpolation" value="${method}">
                        <label class="dialog__formlabel" for="pref_interpolation_${method}">${interpolationMethodStrings[method][0].toUpperCase() + interpolationMethodStrings[method].substring(1)}</label>
                    </div>
                    `).join("") + `

                    <h2 class="dialog__formsection">${strings.stereoMode.select}</h2>
                    <div class="dialog__formfield">
                        <input class="dialog__formcontrol" id="pref_stereomode_auto" type="radio" name="pref_stereomode" value="auto">
                        <label class="dialog__formlabel" for="pref_stereomode_auto">${strings.stereoMode.auto}</label>
                    </div>
                    ` + Object.values(SoftwareRendererDevice.STEREOMODE).map(mode => `
                    <div class="dialog__formfield">
                        <input class="dialog__formcontrol" id="pref_stereomode_${mode}" type="radio" name="pref_stereomode" value="${mode}">
                        <label class="dialog__formlabel" for="pref_stereomode_${mode}">${stereoModeStrings[mode][0].toUpperCase() + stereoModeStrings[mode].substring(1)}</label>
                    </div>
                    `).join("") + `

                    <h2 class="dialog__formsection">${strings.region.select}</h2>
                    <div class="dialog__formfield">
                        <input class="dialog__formcontrol" id="pref_region_pal" type="radio" name="pref_region" value="pal">
                        <label class="dialog__formlabel" for="pref_region_pal">${strings.region.pal}</label>
                    </div>
                    <div class="dialog__formfield">
                        <input class="dialog__formcontrol" id="pref_region_ntsc" type="radio" name="pref_region" value="ntsc">
                        <label class="dialog__formlabel" for="pref_region_ntsc">${strings.region.ntsc}</label>
                    </div>
                </div>
                <div class="dialog__splitpart">
                    <h2 class="dialog__formsection" for="pref_amplification">${strings.stereoMode.crossfeed}</h2>
                    <div class="dialog__formfield">
                        <input class="dialog__formslidervalue" name="pref_crossfeed_value" type="number" min="0" max="100" step="5">
                        <label class="dialog__formslideruom">%</label>
                        <input class="dialog__formslider" name="pref_crossfeed_slider" type="range" min="0" max="100" step="5">
                    </div>

                    <h2 class="dialog__formsection" for="pref_amplification">${strings.amplification}</h2>
                    <div class="dialog__formfield">
                        <input class="dialog__formslidervalue" name="pref_amplification_value" type="number" min="0" max="4" step=".05">
                        <label class="dialog__formslideruom">×</label>
                        <input class="dialog__formslider" type="range" name="pref_amplification_slider" min="0" max="4" step=".05">
                    </div>

                    <h2 class="dialog__formsection" for="pref_defaultpan">${strings.defaultPanWidth}</h2>
                    <div class="dialog__formfield">
                        <input class="dialog__formslidervalue" name="pref_defaultpan_value" type="number" min="0" max="100" step="5">
                        <label class="dialog__formslideruom">%</label>
                        <input class="dialog__formslider" type="range" name="pref_defaultpan_slider" min="0" max="100" step="5">
                    </div>

                    <h2 class="dialog__formsection">${strings.tempoTimer.select}</h2>
                    <div class="dialog__formfield">
                        <input class="dialog__formcontrol" id="pref_timer_auto" type="radio" name="pref_timer" value="auto">
                        <label class="dialog__formlabel" for="pref_timer_auto">${strings.tempoTimer.auto}</label>
                    </div>
                    <div class="dialog__formfield">
                        <input class="dialog__formcontrol" id="pref_timer_cia" type="radio" name="pref_timer" value="cia">
                        <label class="dialog__formlabel" for="pref_timer_cia">${strings.tempoTimer.cia}</label>
                    </div>
                    <div class="dialog__formfield">
                        <input class="dialog__formcontrol" id="pref_timer_accurate" type="radio" name="pref_timer" value="accurate">
                        <label class="dialog__formlabel" for="pref_timer_accurate">${strings.tempoTimer.accurate}</label>
                    </div>
                </div>
            </div>
            <div class="dialog__buttons">
                <button id="pref_reset" class="dialog__button">${strings.resetPreferences}</button>
            </div>
        `
        this.container.appendChild(this.preferencesDialog)
    }

    /**
     * Initialize oscilloscope canvas.
     */

    initUIScopes() {
        const ratio = window.devicePixelRatio
        const canvas = document.getElementById("scopes")
        const rect = canvas.parentElement.getBoundingClientRect()
        this.scopesMono = rect.width <= 600
        this.scopesWidth = rect.width
        this.scopesHeight = rect.height
        canvas.width = rect.width * ratio
        canvas.height = rect.height * ratio
        canvas.style.width = rect.width + "px"
        canvas.style.height = rect.height + "px"
        canvas.getContext("2d").scale(ratio, ratio)
        this.updateUIScopes()
    }

    /**
     * Setup UI event handlers.
     */

    initUIEvents() {

        // Adjust oscilloscopes after viewport resize

        window.addEventListener("resize", () => {
            this.initUIScopes()
        })

        // Open MOD file (eject button)

        const openButton = document.getElementById("button_open")
        const filePicker = document.getElementById("filepicker")
        openButton.addEventListener("click", async e => {
            await this.setupPlayer()
        })
        filePicker.addEventListener("change", async e => {
            for (let i = 0; i < filePicker.files.length; i++) {
                const item = filePicker.files[i]
                try {
                    await this.loadMOD(item)
                    await this.play()
                    return
                } catch(e) {
                    // Unsupported / not a MOD, try next file
                }
            }
        })

        // Handle file drops

        this.container.addEventListener("dragover", e => {
            e.preventDefault()
        })

        this.container.addEventListener("drop", async(e) => {
            e.preventDefault()

            for (let i = 0; i < e.dataTransfer.items.length; i++) {
                const item = e.dataTransfer.items[i]
                if (item.kind !== "file") {
                    continue
                }
                const file = item.getAsFile()
                try {
                    await this.loadMOD(file)
                    await this.play()
                    return
                } catch(e) {
                    // Unsupported / not a MOD, try next file
                }
            }
        })

        // Open preferences dialog (renderer info links)

        document.querySelectorAll(".scopes__link").forEach(link => {
            link.addEventListener("click", e => {
                this.openPreferencesDialog()
                e.preventDefault()
            })
        })

        // Start/stop playback (play/stop button)

        document.getElementById("button_play").addEventListener("click", e => {
            this.handleStartStop()
            e.preventDefault()
        })

        // Open help button

        document.getElementById("button_help").addEventListener("click", e => {
            this.openHelpWindow()
            e.preventDefault()
        })

        // Seek on progress bar

        const progressBar = document.getElementById("progress_bar")
        progressBar.addEventListener("click", e => {
            e.preventDefault()

            if (!this.playing) {
                return
            }

            const width = progressBar.getBoundingClientRect().width
            const ratio = Math.max(0, Math.min(1, e.offsetX / width))
            const position = Math.round(this.song.sequence.length * ratio)
            this.player.setPosition(position, 0, {
                stopSamples: true
            })
        })

        // Toggle keyboard help (keyboard help links)

        document.getElementById("help_link").addEventListener("click", e => {
            this.openHelpWindow()
            e.preventDefault()
        })

        // Handle keyboard events

        document.body.addEventListener("keydown", async e => {
            if (this.keypressProcessing) {
                e.preventDefault()
                return
            }

            // Ignore if a modifier key is held down

            if (e.altKey || e.ctrlKey || e.metaKey) {
                return
            }

            let handled = true
            this.keypressProcessing = true

            try {
                switch ((e.key || "").toLowerCase()) {

                    // Esc: close preferences dialog/open file picker

                    case "escape":
                        if (this.preferencesDialogOpen) {
                            this.closePreferencesDialog()
                        } else {
                            document.getElementById("filepicker").focus()
                            document.getElementById("filepicker").click()
                        }
                        break

                    // Space: start/stop playback

                    case " ":
                        document.activeElement.blur()
                        await this.handleStartStop()
                        break

                    // F1: Toggle keyboard commands help

                    case "f1":
                        this.openHelpWindow()
                        break

                    // F10: Open preferences dialog

                    case "f10":
                        this.openPreferencesDialog()
                        this.preferencesDialog.querySelector(`input[type="radio"]:checked`).focus()
                        break

                    // +: Increase amplification by 0.05

                    case "+":
                        await this.setPreference({ parameters: { amplification:
                            Math.round((this.preferences.parameters.amplification + .05 + Number.EPSILON) * 100) / 100
                        } })
                        break

                    // -: Decrease amplification by 0.05

                    case "-":
                        await this.setPreference({ parameters: { amplification:
                            Math.round((this.preferences.parameters.amplification - .05 + Number.EPSILON) * 100) / 100
                        } })
                        break

                    // 0: Reset amplification to 1.0

                    case "0":
                        await this.setPreference({ parameters: { amplification: 1 } })
                        break

                    // Cursor up/left: Jump to previous song sequence position

                    case "arrowleft":
                    case "arrowup":
                        await this.player.setPosition(-1, 0, {
                            relativePosition: true,
                            stopSamples: true
                        })
                        break

                    // Cursor down/right: Jump to next song sequence position

                    case "arrowright":
                    case "arrowdown":
                        await this.player.setPosition(1, 0, {
                            relativePosition: true,
                            stopSamples: true
                        })
                        break

                    // Home: Restart song

                    case "home":
                        await this.player.setPosition(0, 0, {
                            stopSamples: true
                        })
                        break

                    // W: Use Watte trilinear interpolation

                    case "w":
                        await this.setPreference({
                            autoInterpolation: false,
                            parameters: { interpolation: SoftwareRendererDevice.INTERPOLATION.WATTE }
                        })
                        break

                    // L: Use linear interpolation

                    case "l":
                        await this.setPreference({
                            autoInterpolation: false,
                            parameters: { interpolation: SoftwareRendererDevice.INTERPOLATION.LINEAR }
                        })
                        break

                    // A: Use Amiga (BLEP) interpolation

                    case "a":
                        await this.setPreference({
                            autoInterpolation: false,
                            parameters: { interpolation: SoftwareRendererDevice.INTERPOLATION.BLEP }
                        })
                        break

                    // N: Use nearest neighbor interpolation

                    case "n":
                        await this.setPreference({
                            autoInterpolation: false,
                            parameters: { interpolation: SoftwareRendererDevice.INTERPOLATION.NEAREST }
                        })
                        break

                    // I: Toggle interpolation
                    // Auto -> Nearest neighbor -> Linear -> Watte

                    case "i":
                        const methods = Object.values(SoftwareRendererDevice.INTERPOLATION)
                        let autoInterpolation = this.preferences.autoInterpolation
                        let newMethod = methods[methods.indexOf(this.preferences.parameters.interpolation) + 1]

                        if (autoInterpolation) {
                            autoInterpolation = false
                            newMethod = methods[0]
                        } else if (newMethod === undefined) {
                            newMethod = this.getAutoInterpolation()
                            autoInterpolation = true
                        }

                        await this.setPreference({
                            autoInterpolation: autoInterpolation,
                            parameters: { interpolation: newMethod }
                        })
                        break

                    // M: Force mono output

                    case "m":
                        await this.setPreference({
                            autoStereoMode: false,
                            parameters: { stereoMode: SoftwareRendererDevice.STEREOMODE.MONO }
                        })
                        break

                    // H: Amiga-style hard pan to full left/right

                    case "h":
                        await this.setPreference({
                            autoStereoMode: false,
                            parameters: {
                                stereoMode: SoftwareRendererDevice.STEREOMODE.AMIGA,
                                amigaCrossfeed: 0
                            }
                        })
                        break

                    // X: Amiga-style hard pan with 75% crossfeed

                    case "x":
                        await this.setPreference({
                            autoStereoMode: false,
                            parameters: {
                                stereoMode: SoftwareRendererDevice.STEREOMODE.AMIGA,
                                amigaCrossfeed: .75
                            }
                        })
                        break

                    // R: Real stereo mode for MODs that use pan commands

                    case "r":
                        await this.setPreference({
                            autoStereoMode: false,
                            parameters: { stereoMode: SoftwareRendererDevice.STEREOMODE.STEREO }
                        })
                        break

                    // S: Toggle stereo mode
                    // Automatic -> Mono -> Amiga -> Amiga 75% -> Real stereo

                    case "s":
                        const modes = Object.values(SoftwareRendererDevice.STEREOMODE)
                        const mode = this.preferences.parameters.stereoMode
                        let amigaCrossfeed = this.preferences.parameters.amigaCrossfeed
                        let autoStereoMode = this.preferences.autoStereoMode
                        let newMode = modes[modes.indexOf(mode) + 1]

                        if (autoStereoMode) {
                            autoStereoMode = false
                            newMode = modes[0]
                        } else if (newMode === undefined) {
                            newMode = this.getAutoStereoMode()
                            autoStereoMode = true
                        } else if (newMode === SoftwareRendererDevice.STEREOMODE.AMIGA) {
                            amigaCrossfeed = 0
                        } else if (mode === SoftwareRendererDevice.STEREOMODE.AMIGA && amigaCrossfeed === 0) {
                            newMode = mode
                            amigaCrossfeed = .75
                        }

                        await this.setPreference({
                            autoStereoMode: autoStereoMode,
                            parameters: {
                                stereoMode: newMode,
                                amigaCrossfeed: amigaCrossfeed
                            }
                        })
                        break

                    // Unsupported key, pass to browser

                    default:
                        handled = false
                }

                if (handled) {
                    e.preventDefault()
                }
            } catch(e) {
                console.error(e)
            }

            this.keypressProcessing = false
        })
    }

    /**
     * Toggle the info panel between sample + RMS and keyboard help display.
     */

    openHelpWindow() {
        if (!this.helpWindow || this.helpWindow.closed) {
            this.helpWindow = window.open("ui/help.html")
        } else {
            this.helpWindow.focus()
        }
    }

    /**
     * Start playback when stopped or stop when playing.
     */

    async handleStartStop() {
        if (this.playStateChanging || !this.song) {
            return
        }

        this.playStateChanging = true

        try {
            if (!this.playing) {
                await this.play()
            } else {
                await this.stop()
            }
        } catch(e) {
            console.error(e)
        }

        this.playStateChanging = false
    }

    /**
     * Initialize the preferences dialog.
     */

    initUIPreferencesDialog() {

        // Add close button handler

        ;[this.preferencesDialog, this.preferencesDialog.querySelector(".dialog__close")].forEach(item => {
            item.addEventListener("click", e => {
                if (e.target === item) {
                    this.closePreferencesDialog()
                    e.preventDefault()
                }
            })
        })

        // Interpolation method selection

        this.preferencesDialog.querySelectorAll(`[name="pref_interpolation"]`).forEach(radio => {
            radio.addEventListener("change", e => {
                if (radio.value === "auto") {
                    this.setPreference({
                        autoInterpolation: true,
                        parameters: { interpolation: this.getAutoInterpolation() }
                    })
                } else {
                    this.setPreference({
                        autoInterpolation: false,
                        parameters: { interpolation: parseInt(radio.value, 10) }
                    })
                }
            })
        })

        // Stereo mode selection

        this.preferencesDialog.querySelectorAll(`[name="pref_stereomode"]`).forEach(radio => {
            radio.addEventListener("change", e => {
                if (radio.value === "auto") {
                    this.setPreference({
                        autoStereoMode: true,
                        parameters: { stereoMode: this.getAutoStereoMode() }
                    })
                } else {
                    this.setPreference({
                        autoStereoMode: false,
                        parameters: { stereoMode: parseInt(radio.value, 10) }
                    })
                }
                if (!this.playing) {
                    this.updateUIScopes()
                }
            })
        })

        // Region selection

        this.preferencesDialog.querySelectorAll(`[name="pref_region"]`).forEach(radio => {
            radio.addEventListener("change", e => {
                this.setPreference({ parameters: { region: radio.value } })
            })
        })

        // Crossfeed

        this.preferencesDialog.querySelector(`[name="pref_crossfeed_value"]`).addEventListener("change", e => {
            this.setPreference({ parameters: { amigaCrossfeed: parseFloat(e.target.value) / 100 } })
        })
        this.preferencesDialog.querySelector(`[name="pref_crossfeed_slider"]`).addEventListener("input", e => {
            this.setPreference({ parameters: { amigaCrossfeed: parseFloat(e.target.value) / 100 } })
        })

        // Amplification

        this.preferencesDialog.querySelector(`[name="pref_amplification_value"]`).addEventListener("change", e => {
            this.setPreference({ parameters: { amplification: parseFloat(e.target.value) } })
        })
        this.preferencesDialog.querySelector(`[name="pref_amplification_slider"]`).addEventListener("input", e => {
            this.setPreference({ parameters: { amplification: parseFloat(e.target.value) } })
        })

        // Default pan width for real stereo

        this.preferencesDialog.querySelector(`[name="pref_defaultpan_value"]`).addEventListener("change", e => {
            this.setPreference({ parameters: { defaultPanWidth: parseFloat(e.target.value) / 100 } })
        })
        this.preferencesDialog.querySelector(`[name="pref_defaultpan_slider"]`).addEventListener("input", e => {
            this.setPreference({ parameters: { defaultPanWidth: parseFloat(e.target.value) / 100 } })
        })

        // Tempo timer selection

        this.preferencesDialog.querySelectorAll(`[name="pref_timer"]`).forEach(radio => {
            radio.addEventListener("change", e => {
                if (radio.value === "auto") {
                    this.setPreference({
                        autoTempoTimer: true,
                        parameters: { tempoTimer: this.getAutoTempoTimer() }
                    })
                } else {
                    this.setPreference({
                        autoTempoTimer: false,
                        parameters: { tempoTimer: radio.value }
                    })
                }
            })
        })

        // Reset to defaults button

        this.preferencesDialog.querySelector(`[id="pref_reset"]`).addEventListener("click", async e => {
            this.preferences = {}
            this.setDefaultPreferences()
            if (this.preferences.autoInterpolation) {
                this.preferences.parameters.interpolation = this.getAutoInterpolation()
            }
            if (this.preferences.autoStereoMode) {
                this.preferences.parameters.stereoMode = this.getAutoStereoMode()
            }
            if (this.preferences.autoTempoTimer) {
                this.preferences.parameters.tempoTimer = this.getAutoTempoTimer()
            }
            await this.player.setParameters(this.preferences.parameters)
            Object.assign(this.preferences.parameters, await this.player.getParameters())
            this.updatePreferences()
            e.preventDefault()
        })
    }

    /**
     * Open the preferences dialog.
     */

    openPreferencesDialog() {
        document.documentElement.scrollTop = 0
        document.documentElement.classList.add("noscroll")
        this.preferencesDialog.classList.add("dialog__freeze--visible")
        this.preferencesDialogOpen = true
    }

    /**
     * Close the preferences dialog.
     */

    closePreferencesDialog() {
        document.documentElement.classList.remove("noscroll")
        this.preferencesDialog.classList.remove("dialog__freeze--visible")
        this.preferencesDialogOpen = false
    }

    /**
     * Update textual UI elements that depend on song progress.
     *
     * @param {object} [progress]
     *      Object describing song progress. When omitted, stopped state is
     *      assumed.
     * @param {number} progress.sequence
     *      Index of the currently played sequence.
     * @param {number} progress.row
     *      Index of the currently played row.
     * @param {number} progress.playtime
     *      Number of seconds elapsed since playback started.
     * @param {number} progress.ratio
     *      Ratio of playback progress between 0 - 1.
     */

    updateUIProgress(progress) {
        progress = progress || {}

        // Song position

        document.getElementById("song_position").textContent = "sequence" in progress ? supplant(strings.header.position, {
            sequence: progress.sequence,
            row: hexDigits[(progress.row & 0xf0) >> 4] + hexDigits[progress.row & 0x0f]
        }) : strings.header.stopped

        // Elapsed time since playback start

        let hours = 0
        let minutes = 0
        let seconds = 0
        if (progress.playtime) {
            hours = Math.floor(progress.playtime / 3600)
            minutes = Math.floor(progress.playtime / 60) % 60
            seconds = Math.floor(progress.playtime) % 60
        }
        document.getElementById("elapsed_time").textContent = (
            (hours > 0? (hours + ":") : "") +
            ((hours > 0 && minutes < 10) ? ("0" + minutes + ":") : (minutes + ":")) +
            (seconds < 10 ? ("0" + seconds) : seconds)
        )

        // Song progress bar

        document.getElementById("progress_ratio").style.transform =
            `scale(${(Math.min(1, Math.max(0, progress.ratio) || 0))}, 1)`
    }

    /**
     * Update UI elements that depend on the currently loaded song.
     */

    updateUISongProperties() {
        if (!this.song) {
            document.title = strings.appTitle
            document.getElementById("song_title").textContent = this.songFilename || strings.header.noSong
            document.getElementById("button_play").classList.add("info__control--hide")
            document.getElementById("num_channels").textContent = strings.numChannels[0]
            for (let i = 0; i < 32; i++) {
                document.getElementById(`sample_${i}`).textContent = String.fromCharCode(160)
                document.getElementById(`sample_vu_${i}`).style.transform = `scale(0, 1)`
            }
            return
        }

        // Song title or MOD file name when song has no title

        const songTitle = this.song.title.trim() || this.songFilename.trim().toLowerCase()
        document.title = songTitle + " - " + strings.appTitle
        document.getElementById("song_title").textContent = songTitle.replace(/ /g, String.fromCharCode(160))

        // Number of channels

        document.getElementById("num_channels").textContent = supplant(strings.numChannels[
            !this.song ? 0 : (this.song.numChannels === 1 ? 1 : 2)
        ], {
            numChannels: this.song.numChannels
        })

        // Samples

        this.song.samples.forEach((sample, i) => {
            document.getElementById(`sample_${i}`).textContent = (
                sample.name.replace(/ /g, String.fromCharCode(160)) || String.fromCharCode(160)
            )
        })
    }

    /**
     * Update UI elements that depend on preferences.
     */

    updateUIPreferences() {

        // Update on player UI

        // Stereo mode and crossfeed

        document.getElementById("stereo_mode").textContent = stereoModeStrings[this.preferences.parameters.stereoMode] +
        (this.preferences.autoStereoMode ? strings.stereoMode.autoSelect : "") +
        (this.preferences.parameters.stereoMode === SoftwareRendererDevice.STEREOMODE.AMIGA ? supplant(strings.stereoMode.crossfeedInfo, {
            crossfeed: Math.round(this.preferences.parameters.amigaCrossfeed * 100)
        }) : "")

        // Amplification and interpolation method

        document.getElementById("interpolation").textContent = supplant(strings.interpolation.andAmplify, {
            amplification: this.preferences.parameters.amplification,
            method: interpolationMethodStrings[this.preferences.parameters.interpolation]
        }) + (this.preferences.autoInterpolation ? strings.interpolation.autoSelect : "")

        // Renderer name and sample rate

        document.getElementById("renderer").textContent = strings.renderer[this.renderer.constructor.name] + (this.renderer.sampleRate ?
            supplant(strings.renderer.sampleRate, { sampleRate: this.renderer.sampleRate }) : ""
        )

        // Update on preferences dialog

        // Interpolation method

        this.preferencesDialog.querySelector(`[name="pref_interpolation"][value="auto"]`).checked = this.preferences.autoInterpolation
        this.preferencesDialog.querySelectorAll(`[name="pref_interpolation"]:not([value="auto"])`).forEach(item => {
            item.checked = !this.preferences.autoInterpolation && (parseInt(item.value, 10) === this.preferences.parameters.interpolation)
        })

        // Stereo mode

        this.preferencesDialog.querySelector(`[name="pref_stereomode"][value="auto"]`).checked = this.preferences.autoStereoMode
        this.preferencesDialog.querySelectorAll(`[name="pref_stereomode"]:not([value="auto"])`).forEach(item => {
            item.checked = !this.preferences.autoStereoMode && (parseInt(item.value, 10) === this.preferences.parameters.stereoMode)
        })

        // Region

        this.preferencesDialog.querySelectorAll(`[name="pref_region"]`).forEach(item => {
            item.checked = item.value === this.preferences.parameters.region
        })

        // Amiga crossfeed %

        this.preferencesDialog.querySelectorAll(`[name="pref_crossfeed_value"],[name="pref_crossfeed_slider"]`).forEach(item => {
            item.value = Math.round(this.preferences.parameters.amigaCrossfeed * 20) * 5
        })

        // Amplification

        this.preferencesDialog.querySelectorAll(`[name="pref_amplification_value"],[name="pref_amplification_slider"]`).forEach(item => {
            let value = (Math.round(this.preferences.parameters.amplification * 20) / 20) + ""
            let decimalPos = value.indexOf(".")
            if (decimalPos < 0) {
                value += ".00"
            } else if (decimalPos === value.length - 2) {
                value += "0"
            }
            item.value = value
        })

        // Default stereo pan %

        this.preferencesDialog.querySelectorAll(`[name="pref_defaultpan_value"],[name="pref_defaultpan_slider"]`).forEach(item => {
            item.value = Math.round(this.preferences.parameters.defaultPanWidth * 20) * 5
        })

        // Tempo timer

        this.preferencesDialog.querySelector(`[name="pref_timer"][value="auto"]`).checked = this.preferences.autoTempoTimer
        this.preferencesDialog.querySelectorAll(`[name="pref_timer"]:not([value="auto"])`).forEach(item => {
            item.checked = !this.preferences.autoTempoTimer && (item.value === this.preferences.parameters.tempoTimer)
        })
    }

    /**
     * Calculate the RMS of a sample at a given position.
     *
     * @param {number} sampleNr
     *      Index of the sample.
     * @param {number} volume
     *      Playback volume of the sample between 0 - 1.
     * @param {number} samplePosition
     *      Playback position within the sample.
     * @returns {number}
     *      RMS value between 0 - 1.
     */

    getSampleRMS(sampleNr, volume, samplePosition) {
        samplePosition = Math.floor(samplePosition)

        // No song or volume is 0

        if (!this.song || volume === 0 || !this.playing) {
            return 0
        }

        // No sample or unsupported sample format

        const sample = this.song.samples[sampleNr]
        if (!sample || !sample.audioSample || !(sample.audioSample instanceof Int8Array)) {
            return 0
        }

        // Sample end reached

        const audioSample = sample.audioSample
        const sampleLength = sample.loopLength > 0 ? sample.loopStart + sample.loopLength : audioSample.length
        if (samplePosition >= sampleLength && sample.loopLength === 0) {
            return 0
        }

        // Calculate sum of squared sample values over RMS window

        let sqValue = 0
        for (let i = 0; i < rmsWindow; i++) {
            const sv = audioSample[samplePosition] / 128
            sqValue += sv * sv
            samplePosition++
            if (samplePosition >= sampleLength) {
                if (sample.loopLength === 0) {
                    break
                } else {
                    samplePosition -= sample.loopLength
                }
            }
        }

        // RMS = square root of average of squared sample values

        return Math.sqrt(sqValue / rmsWindow) * volume
    }

    /**
     * Update sample RMS bars on the UI.
     *
     * @param {object} channelInfo
     *      Channel information object as returned by the player's getInfo()
     *      method.
     */

    updateUISampleRMS(channelInfo) {
        if (!this.song) {
            return
        }

        const decayMultiplier = Math.max(0, 1 - (performance.now() - this.lastVSyncTime) / 32)
        const sampleRMS = {}
        const rmsLogLimit = rmsLogLimitdB / -10
        const rmsLinLimit = Math.pow(10, rmsLogLimitdB / 10)

        // Calculate RMS for each channel and aggregate for samples

        if (channelInfo) {
            channelInfo.forEach(channel => {
                const sampleNr = channel.sampleIndex
                const rms = this.getSampleRMS(sampleNr, channel.volume, channel.samplePosition)
                sampleRMS[sampleNr] = sampleRMS[sampleNr] || 0
                sampleRMS[sampleNr] += rms
            })
        }

        // Display RMS of each sample

        for (let i = 0; i < this.song.samples.length; i++) {
            const rms = sampleRMS[i] || 0
            let ratio = (rms <= rmsLinLimit ? rms * rmsBarScaleRatio : (
                (rmsLinLimit + (rmsLogLimit + Math.log10(rms)) / rmsLogLimit) * rmsBarScaleRatio
            ))
            const minRatio = Math.max(.0001, (this.prevSampleRMSRatio[i] || 0) * decayMultiplier)

            // Apply decay smoothing

            if (ratio < minRatio) {
                ratio = minRatio === .0001 ? 0 : minRatio
            }
            if (ratio === 0) {
                delete this.prevSampleRMSRatio[i]
            } else {
                this.prevSampleRMSRatio[i] = ratio
            }
            document.getElementById(`sample_vu_${i}`).style.transform = `scale(${ratio}, 1)`
        }
    }

    /**
     * Update the oscilloscope(s) on the UI.
     */

    updateUIScopes() {
        const canvas = document.getElementById("scopes")
        const canvasCtx = canvas.getContext("2d")
        const width = this.scopesWidth
        const height = this.scopesHeight
        const bufferLength = 1024
        let scopePadding = this.scopesMono ? 0 : 60
        let scopeWidth = Math.floor((width - scopePadding) / 2)
        if (this.scopesMono) {
            scopeWidth = width
        } else if (this.preferences.parameters.stereoMode === SoftwareRendererDevice.STEREOMODE.MONO) {
            scopeWidth *= 2
        }

        // Clear the canvas

        canvasCtx.fillStyle = cssBgColor
        canvasCtx.fillRect(0, 0, width, height)

        // Draw the scope limit lines

        function drawScopeLimitLines(x) {
            canvasCtx.lineWidth = 1
            canvasCtx.strokeStyle = cssScopeLimitColor
            canvasCtx.beginPath()
            canvasCtx.moveTo(x, .5)
            canvasCtx.lineTo(x + scopeWidth, .5)
            canvasCtx.stroke()
            canvasCtx.beginPath()
            canvasCtx.moveTo(x, height - .5)
            canvasCtx.lineTo(x + scopeWidth, height - .5)
            canvasCtx.stroke()
        }

        if (this.scopesMono) {
            drawScopeLimitLines(0)
        } else if (this.preferences.parameters.stereoMode === SoftwareRendererDevice.STEREOMODE.MONO) {
            drawScopeLimitLines(Math.floor((width - scopeWidth) / 2))
        } else {
            drawScopeLimitLines(0)
            drawScopeLimitLines(width - scopeWidth)
        }

        // Draw the waveform

        let output = null
        if (this.playing) {
            output = this.player.getOutputSamples()
        }
        if (output) {

            // Try to establish the zero crossing point

            const maxZeroCrossingPos = (bufferLength >> 1)
            const zeroCrossingSampleCount = 64
            let zeroCrossingPos = 0
            let i = 0
            while (zeroCrossingPos < maxZeroCrossingPos && output.left[zeroCrossingPos] + output.right[zeroCrossingPos] > 0 && i < zeroCrossingSampleCount) {
                i += output.left[zeroCrossingPos] + output.right[zeroCrossingPos] < 0 ? 1 : -1
                zeroCrossingPos++
            }
            i = 0
            while (zeroCrossingPos < maxZeroCrossingPos && output.left[zeroCrossingPos] + output.right[zeroCrossingPos] < 0 && i < zeroCrossingSampleCount) {
                i += output.left[zeroCrossingPos] + output.right[zeroCrossingPos] > 0 ? 1 : -1
                zeroCrossingPos++
            }
            if (zeroCrossingPos >= maxZeroCrossingPos) {
                zeroCrossingPos = zeroCrossingSampleCount * 2
            } else {
                zeroCrossingPos += zeroCrossingSampleCount
            }

            // Draw the oscilloscope

            function drawScope(x, samples, addSamples) {
                const sliceWidth = (width * 1.0) / bufferLength

                canvasCtx.lineWidth = 1
                canvasCtx.strokeStyle = cssScopeColor
                canvasCtx.beginPath()

                let prevSV = 0
                let y = 0
                for (let i = 0; i < scopeWidth / width * bufferLength; i++, x += sliceWidth) {
                    let sv = Math.min(1, Math.max(samples[i + zeroCrossingPos], -1))

                    // Calculate average for mono scope

                    if (addSamples) {
                        sv = (sv + Math.min(1, Math.max(addSamples[i + zeroCrossingPos], -1))) / 2
                    }

                    // Previous clipping over, change stroke color to normal

                    if (Math.abs(prevSV) === 1 && Math.abs(sv) < 1 && i > 0) {
                        canvasCtx.stroke()
                        canvasCtx.strokeStyle = cssScopeColor
                        canvasCtx.beginPath()
                        canvasCtx.moveTo(x - sliceWidth, y)
                    }

                    y = height / 2 + (sv * (height - 1)) / 2
                    if (i === 0) {
                        canvasCtx.moveTo(x, y)
                    } else {
                        canvasCtx.lineTo(x, y)
                    }

                    // Reached clipping limit, change stroke color to clipping

                    if (Math.abs(sv) === 1 && prevSV !== sv) {
                        canvasCtx.stroke()
                        canvasCtx.strokeStyle = cssScopeLimitCrossColor
                        canvasCtx.beginPath()
                        canvasCtx.moveTo(x, y)
                    }
                    prevSV = sv
                }

                canvasCtx.stroke()
            }

            if (this.scopesMono) {
                drawScope(0, output.left, output.right)
            } else if (this.preferences.parameters.stereoMode === SoftwareRendererDevice.STEREOMODE.MONO) {
                drawScope(Math.floor((width - scopeWidth) / 2), output.left)
            } else {
                drawScope(0, output.left)
                drawScope(width - scopeWidth, output.right)
            }

        }

        // Draw the scope lines

        function drawScopeLines(x) {
            canvasCtx.lineWidth = 1
            canvasCtx.strokeStyle = cssScopeLineColor
            canvasCtx.beginPath()
            canvasCtx.moveTo(x, height / 2)
            canvasCtx.lineTo(x + scopeWidth, height / 2)
            canvasCtx.stroke()
            canvasCtx.beginPath()
            canvasCtx.moveTo(x, (height / 2 - height / 2 * Math.SQRT1_2))
            canvasCtx.lineTo(x + scopeWidth, (height / 2 - height / 2 * Math.SQRT1_2))
            canvasCtx.stroke()
            canvasCtx.beginPath()
            canvasCtx.moveTo(x, (height / 2 + height / 2 * Math.SQRT1_2))
            canvasCtx.lineTo(x + scopeWidth, (height / 2 + height / 2 * Math.SQRT1_2))
            canvasCtx.stroke()
        }

        if (this.scopesMono) {
            drawScopeLines(0)
        } else if (this.preferences.parameters.stereoMode === SoftwareRendererDevice.STEREOMODE.MONO) {
            drawScopeLines(Math.floor((width - scopeWidth) / 2))
        } else {
            drawScopeLines(0)
            drawScopeLines(width - scopeWidth)
        }
    }

    /**
     * Update dynamic UI parts at every retrace (vertical sync).
     *
     * @param {boolean} [playStarted=false]
     *      True indicates that playback has just started and the update shall
     *      continue until the player is stopped. This is used to differentiate
     *      between the initial and period vsync invocations if the method.
     */

    updateUIVSync(playStarted) {

        // Check if an update is already scheduled for the next vsync

        if (playStarted === true && this.vsyncHandler) {
            return
        }

        // Update playback-dependent UI content

        if (playStarted) {
            this.lastVSyncTime = performance.now()
        }

        const playerInfo = this.player.getInfo()
        if (this.playing && playerInfo) {
            this.updateUIProgress({
                sequence: playerInfo.status.position,
                row: playerInfo.status.row,
                playtime: playerInfo.playTimestamp,
                ratio: Math.min(1, (
                    playerInfo.status.position * 64 + playerInfo.status.row +
                    playerInfo.status.tick / playerInfo.status.speed
                ) / (this.song.sequence.length * 64))
            })
            this.updateUIScopes()
            this.updateUISampleRMS(playerInfo.status.channels)
        } else {
            this.updateUIProgress()
            this.updateUIScopes()
            this.updateUISampleRMS()
        }

        this.lastVSyncTime = performance.now()

        // Schedule update for next vsync until:
        // - the song is being played
        // - RMS bars have settled to 0

        if (this.playing || Object.keys(this.prevSampleRMSRatio).length > 0) {
            this.vsyncHandler = window.requestAnimationFrame(() => {
                this.updateUIVSync()
            })
        } else {
            this.vsyncHandler = null
        }

        // Song speed changed to 0, stop playback

        if (playerInfo && playerInfo.status.speed === 0) {
            this.stop()
        }
    }
}

// Start the application

(new TMODPlay()).main()