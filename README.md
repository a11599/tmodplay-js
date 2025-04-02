This is the Javascript/browser version of

[Therapy MOD player](https://github.com/a11599/tmodplay) (tmodplay)
===================================================================

_an audio player for the [MOD music format](https://en.wikipedia.org/wiki/MOD_(file_format))_

- Multichannel support
- Floating point mixers with volume ramping
- Variable amplification with clipping
- Various sample interpolation methods
- Stereo crossfade for hard panned (Amiga) MODs
- Real stereo mode for MODs utilizing panning commands
- Responsive graphical user interface with keyboard and mouse support, scopes and RMS meters

It delivers 107% of the original tmodplay experience in the browser with a few improvements (floating point mixing for cleaner audio, BLEP interpolation, volume ramping for click-free playback, high resolution UI, mouse support).

Try it on https://a11599.github.io/tmodplay-js/!


# Why?

There are some interesting recent high level languages that I ponder learning and tmodplay seemed to be a good candidate as a porting exercise because it does quite a lot of things. But for this I prefer having a cleaner base reference than the heavily 386-optimized x86 assembly source of [mod](https://github.com/a11599/mod). So here it is.

The player requires a recent browser. It uses (among others):

- [Javascript classes](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes)
- [Javascript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- The [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API), rendering in a background thread via [AudioWorkletProcessor](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor)
- [Asynchronous functions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function)
- [ArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer) and [typed arrays](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Typed_arrays) to handle binary data
- [Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API) to render the oscilloscopes

The player has no external dependencies, all it needs is a standards-compliant browser. The fact that doing something like this is possible in the browser without resorting to all kinds of hacks and trickery shows how far the platform got. Even more impressive is that playing `dope.mod` uses only a few percent of an Intel Coffee Lake (8th gen) core at maximum sound quality settings (or even BLEP interpolation) when the code is not even optimized at all.


# Usage

Drop a .mod file onto the page or click the eject button to open the file picker dialog. After dropping/opening the file, tmodplay will parse it and start playback (when dropping in Firefox you also have to click the play button for the first time).

Click "Press F1 for help" or the exclamation mark icon on mobile, or actually press `F1` to view the user guide for details.


# Building from source

This webapplication requires no build process, it runs as-is from source. For development an HTTP server is needed, because Javascript modules cannot be loaded from file sources.

A simple no-dependency HTTP server is provided in `server.js` which needs [node.js](https://nodejs.org/). Install node.js and run `node server` to start it, then open http://localhost in the browser of your choice. If port 80 is in use on your machine, you can specify an alternate port as a command line argument. For example to run the HTTP server on port 3000, run `node server 3000`.