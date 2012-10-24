define([
    "js/util",
    "js/AST",
    "vendor/esprima/esprima"
], function (
    util,
    AST,
    parser
) {
    "use strict";

    var slice = [].slice;

    function Stepper(ast) {
        this.ast = ast;
        this.evaluator = null;
        this.fn = null;
        this.position = 0;
        this.statementWrappers = null;
        this.context = null;
    }

    util.extend(Stepper.prototype, {
        back: function () {
            this.position -= 1;
        },

        call: function (context) {
            var tools;

            this.context = context;

            tools = this.fn.apply(this, slice.call(arguments, 1));

            this.evaluator = tools.evaluator;
            this.statementWrappers = tools.statementWrappers;
        },

        evaluate: function (expression) {
            return this.evaluator(expression);
        },

        execute: function () {
            this.statementWrappers[this.position].call(this.context, this);
        },

        forward: function () {
            this.position += 1;
        },

        parse: function (fn) {
            var ast = this.ast,
                parsed = parseFunction(fn);

            ast.parseParserAPISyntax(parser.parse(parsed.source));

            ast.prehoist();
            ast.wrapStatements();

            this.fn = new Function(parsed.args, ast.generate());
        },

        step: function () {
            this.execute();
            this.forward();
        },

        stepIn: function () {

        }
    });

    function parseFunction(fn) {
        var source = fn.toSource ? fn.toSource() : fn.toString(),
            argsRegex = /\(([^\)]*)\)/,
            args = argsRegex.exec(source)[1].replace(/^\s*|\s*$/g, "");

        source = source.replace(/^\s*function[\s\S]*?\{|\}\s*$/g, "");

        return {
            args: args,
            source: source
        };
    }

    return Stepper;
});
