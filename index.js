#!/usr/bin/env node

var WEBMODULE_IDIOM = (this || 0).self || global;

(function(global) {

var USAGE = _multiline(function() {/*
    Usage:
        node Salvage.js [-h or --help]
                        [-v or --verbose]
                        [--type png|wav|all]
                        [--outdir output-directory]
                        [--index start-index]
                        input-binary-file

    See:
        https://github.com/uupaa/Salvage.js/wiki/Salvage
*/});


var CONSOLE_COLOR = {
        RED:    "\u001b[31m",
        YELLOW: "\u001b[33m",
        GREEN:  "\u001b[32m",
        CLEAR:  "\u001b[0m"
    };

var fs      = require("fs");
var argv    = process.argv.slice(2);
var options = _parseCommandLineOptions({
        help:       false,      // Boolean - show help.
        verbose:    false,      // Boolean - verbose mode.
        type:       "all",      // String - "png" or "wav" or "all"
        input:      "",         // String - input file.
        index:      0,          // Integer - start index
        outdir:     "./"        // String - output directory.
    });

if (options.help) {
    console.log(CONSOLE_COLOR.YELLOW + USAGE + CONSOLE_COLOR.CLEAR);
    return;
}

if (options.verbose) {
}

if (options.input) {
    var buffer = fs.readFileSync(options.input);

    if ( /(png|all)/.test(options.type) ) {
        _writeFile(_pickupEmbeddedPngFiles(buffer), function(index) {
            index += options.index;
            return options.outdir + ("00000" + index).slice(-4) + ".png";
        });
    }
    if ( /(wav|wave|all)/.test(options.type) ) {
        _writeFile(_pickupEmbeddedWaveFiles(buffer), function(index) {
            index += options.index;
            return options.outdir + ("00000" + index).slice(-4) + ".wav";
        });
    }
}

function _writeFile(buffers,    // @arg BufferArray - [buffer, ...]
                    callback) { // @arg Function
    for (var i = 0, iz = buffers.length; i < iz; ++i) {
        var path = callback(i);

        if (options.verbose) {
            console.log("create file " + path + " (" + ("      " + (buffers[i].length / 1024).toFixed(1)).slice(-6) + " KB)");
        }
        fs.writeFileSync(path, buffers[i]);
    }
}

function _pickupEmbeddedPngFiles(buffer) { // @arg Buffer
                                           // @ret BufferArray - [buffer, ...]
    var PNG_SIGNATURE = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    var IEND_CHUNK    = [0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82];
                     //  -----------------------   I      E     N     D  --------checksum------

    var result = [];
    var seek = false;
    var pos = 0;

    for (var i = 0, iz = buffer.length; i < iz; ++i) {

        if (seek) {
            if ( isPNGIENDChunk(buffer, i) ) {
                result.push( buffer.slice(pos, i + IEND_CHUNK.length) );
                seek = false;
                pos = 0;
                i += IEND_CHUNK.length;
            }
        } else if ( isPNGSignature(buffer, i) ) {
            if (options.verbose) {
                console.log("found PNG Signature");
            }
            seek = true;
            pos = i;
            i += PNG_SIGNATURE.length;
        }
    }
    return result;

    function isPNGSignature(buffer, index) {
        for (var i = 0, iz = PNG_SIGNATURE.length; i < iz; ++i) {
            if ( buffer[index + i] !== PNG_SIGNATURE[i] ) {
                return false;
            }
        }
        return true;
    }
    function isPNGIENDChunk(buffer, index) {
        for (var i = 0, iz = IEND_CHUNK.length; i < iz; ++i) {
            if ( buffer[index + i] !== IEND_CHUNK[i] ) {
                return false;
            }
        }
    }
}

function _pickupEmbeddedWaveFiles(buffer) { // @arg Buffer
                                            // @ret BufferArray - [buffer, ...]
    var WAVE_SIGNATURE = [0x52, 0x49, 0x46, 0x46, -1, -1, -1, -1, 0x57, 0x41, 0x56, 0x45];
                       //   R     I     F     F   ---file-size---   W     A     V     E
    var result = [];

    for (var i = 0, iz = buffer.length; i < iz; ++i) {

        if (isWaveSignature(buffer, i)) {
            var size = buffer[i + 4] +
                       buffer[i + 5] * 0x100 +
                       buffer[i + 6] * 0x10000 +
                       buffer[i + 7] * 0x1000000 +
                       4; // "RIFF".length
            if (options.verbose) {
                console.log("found WAVE Signature, size = 0x" + size.toString(16) + " (" + size + ") byte");
            }
            result.push( buffer.slice(i, i + size) );
            i += size;
        }
    }
    return result;

    function isWaveSignature(buffer, index) {
        for (var i = 0, iz = WAVE_SIGNATURE.length; i < iz; ++i) {
            if ( WAVE_SIGNATURE[i] >= 0x00 ) {
                if ( buffer[index + i] !== WAVE_SIGNATURE[i] ) {
                    return false;
                }
            }
        }
        return true;
    }
}

function _parseCommandLineOptions(options) { // @arg Object:
                                             // @ret Object:
    for (var i = 0, iz = argv.length; i < iz; ++i) {
        switch (argv[i]) {
        case "-h":
        case "--help":      options.help = true; break;
        case "-v":
        case "--verbose":   options.verbose = true; break;
        case "--index":     options.index = parseInt(argv[++i]); break;
        case "--outdir":
            options.outdir = argv[++i];
            if (!fs.existsSync(options.outdir)) {
                throw new TypeError("Directory not exists: " + options.outdir);
            }
            options.outdir = options.outdir.replace(/\/+$/, "") + "/";
            break;
        case "--type":
            options.type = argv[++i];
            if (!/^(png|wav|wave|all)$/.test(options.type)) {
                options.help = true;
            }
            break;
        default:
            options.input = argv[i];
            if (!fs.existsSync(options.input)) {
                throw new TypeError("File not exists: " + options.input);
            }
        }
    }
    if (!options.input) {
        options.help = true;
    }
    return options;
}

function _multiline(fn) { // @arg Function:
                          // @ret String:
    return (fn + "").split("\n").slice(1, -1).join("\n");
}

})((this || 0).self || global);

