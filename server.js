const fs = require("node:fs")
const fpath = require("node:path")
const http = require("node:http")

function main() {
    const port = parseInt(process.argv[2], 10) || 80

    // List of file extension - mime type pairs for files that we know of - if
    // some file extension is not recognized, no mime type will be sent in the
    // response

    const mimeTypes = {
        "3gp": "video/3gpp",
        "3g2": "video/3gpp2",
        "7z": "application/x-7z-compressed",
        "aac": "audio/aac",
        "apng": "image/png",
        "avif": "image/avif",
        "avi": "video/x-msvideo",
        "bin": "application/octet-stream",
        "bmp": "image/bmp",
        "css": "text/css",
        "csv": "text/csv",
        "doc": "application/msword",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "eot": "application/vnd.ms-fontobject",
        "exe": "application/octet-stream",
        "gz": "application/gzip",
        "gif": "image/gif",
        "htm": "text/html",
        "html": "text/html",
        "ico": "image/vnd.microsoft.icon",
        "ics": "text/calendar",
        "jar": "application/java-archive",
        "jpeg": "image/jpeg",
        "jpg": "image/jpeg",
        "js": "text/javascript",
        "json": "application/json",
        "jsonld": "application/ld+json",
        "mid": "audio/midi",
        "midi": "audio/midi",
        "mjs": "text/javascript",
        "mp3": "audio/mpeg",
        "mp4": "video/mp4",
        "mpeg": "video/mpeg",
        "mpg": "video/mpeg",
        "odp": "application/vnd.oasis.opendocument.presentation",
        "ods": "application/vnd.oasis.opendocument.spreadsheet",
        "odt": "application/vnd.oasis.opendocument.text",
        "oga": "audio/ogg",
        "ogg": "audio/ogg",
        "ogv": "video/ogg",
        "ogx": "application/ogg",
        "opus": "audio/opus",
        "otf": "font/otf",
        "png": "image/png",
        "pdf": "application/pdf",
        "ppt": "application/vnd.ms-powerpoint",
        "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "rar": "application/vnd.rar",
        "rtf": "application/rtf",
        "svg": "image/svg+xml",
        "tar": "application/x-tar",
        "tif": "image/tiff",
        "tiff": "image/tiff",
        "ts": "video/mp2t",
        "ttf": "font/ttf",
        "txt": "text/plain",
        "vsd": "application/vnd.visio",
        "wav": "audio/wav",
        "weba": "audio/webm",
        "webm": "audio/webm",
        "webp": "image/webp",
        "woff": "font/woff",
        "woff2": "font/woff2",
        "xhtml": "application/xhtml+xml",
        "xls": "application/vnd.ms-excel",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "xml": "application/xml",
        "zip": "application/zip"
    }

    // Start an HTTP server

    http.createServer({}, (request, response) => {
        const corsOptions = request.method.toLowerCase() === "options"
        const target = new URL(`http://localhost${request.url}`)
        let checkFile = true
        let fileExists = true

        // Serve the file from local folder

        if (!corsOptions) {
            let filename = fpath.join(__dirname, `${target.pathname}`)
            let stat

            while (checkFile && fileExists) {
                if (fileExists = fs.existsSync(filename)) {
                    stat = fs.statSync(filename)

                    // It's a directory, return contents of index.html

                    if (stat.isDirectory()) {
                        filename = fpath.join(filename, "index.html")
                        stat = fs.statSync(filename)
                    } else {
                        checkFile = false
                    }
                }
            }

            // Could not find target: 404

            if (!fileExists) {
                response.writeHead(404)
                response.end()
                return
            }

            // Return file contents, use no-cache since this browser caching is
            // not beneficial for development

            const {size, mtime} = stat
            const mimeType = mimeTypes[filename.split('.').pop()]

            response.writeHead(200, Object.assign({
                "Content-Length": size,
                "Last-Modified": mtime.toUTCString(),
                "Cache-control": "no-cache"
            }, mimeType ? {
                "Content-Type": mimeType
            } : {}))
            response.end(fs.readFileSync(filename))
        }
    }).listen(port)

    // Print info on server to console

    console.log(
        `Webserver running on http://localhost${(port !== 80 ? (`:${port}`) : "")}\n` +
        `Press Ctrl-C to terminate.\n\n` +
        `To listen on a specific port, provide the port as an argument, for example:\n` +
        `node server 8080`
    )
}

main()