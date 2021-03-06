'use strict';
var gutil = require('gulp-util');
var through = require('through2');
var esprima = require('esprima');
var path = require('path');

//test for comments that have todo/fixme + text
var rCommentsValidator = /^(\W)*(TODO|FIXME)+(?:\s)*?(?:\S)+/i;
//split todo/fixme comments
var rCommentsSplit = /(TODO|FIXME):?/i;

/**
 * generateContents
 * generates the markdown output
 * TODO export to a lib
 *
 * @param comments
 * @param newLine
 * @return
 */
var generateContents = function (comments, newLine) {
    var output = {
        TODO: '',
        FIXME: ''
    };

    comments.forEach(function (comment) {
        output[comment.kind] += '| ' + comment.file + ' | ' + comment.line + ' | ' + comment.text + newLine;
    });

    var contents;

    contents = '## TODOs' + newLine;
    contents += '| Filename | line # | value' + newLine;
    contents += '| -------- | ------ | ------' + newLine;
    contents += output.TODO + newLine + newLine;

    contents += '## FIXMEs' + newLine;
    contents += '| Filename | line # | value' + newLine;
    contents += '| -------- | ------ | ------' + newLine;
    contents += output.FIXME;

    return contents;
};

/**
 * getCommentsFromAst
 * returns an array of comments generated from this file
 * TODO export to a lib
 *
 * @param ast
 * @param file
 * @return
 */
var getCommentsFromAst = function (ast, file) {
    return ast.comments.filter(function (comment) {
        return rCommentsValidator.test(comment.value);
    }).map(function (comment) {
        //get splitted comment
        var _splitted = comment.value.trim().split(rCommentsSplit);
        //get relative file name
        var _file = file.path.replace(file.cwd + path.sep, '');
        //get comment text
        var _text = _splitted[2].trim();
        //get comment kind
        var _kind = _splitted[1].trim().toUpperCase();
        //get comment line
        var _line = comment.loc.start.line;

        return {
            file: _file,
            text: _text,
            kind: _kind,
            line: _line
        };
    });
};

module.exports = function (params) {
    params = params || {};
    var fileName = params.fileName || 'todo.md';
    var firstFile;
    var newLine = params.newLine || gutil.linefeed;
    var comments = [];

    /* main object iteration */
    return through.obj(function (file, enc, cb) {
            if (file.isNull()) {
                return cb();
            }

            if (file.isStream()) {
                this.emit('error', new gutil.PluginError('gulp-todo', 'Streaming not supported'));
                return cb();
            }
            var ast;

            try {
                ast = esprima.parse(file.contents.toString('utf8'), {
                    tolerant: true,
                    comment: true,
                    loc: true
                });
            } catch (err) {
                err.message = 'gulp-todo: ' + err.message;
                this.emit('error', new gutil.PluginError('gulp-todo', err));
            }

            //assign first file to get relative cwd/path
            if (!firstFile) {
                firstFile = file;
            }

            //todo better rename
            comments = comments.concat(getCommentsFromAst(ast, file));

            return cb();
        },
        function (cb) {
            if (!firstFile || !comments.length) {
                return cb();
            }

            //get generated output
            var contents = generateContents(comments, newLine);

            this.push(new gutil.File({
                cwd: firstFile.cwd,
                base: firstFile.cwd,
                path: path.join(firstFile.cwd, fileName),
                contents: new Buffer(contents)
            }));
            return cb();
        });
};
