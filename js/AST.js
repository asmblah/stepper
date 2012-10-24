define([
    "js/util",
    "js/Pragma",
    "js/Pragma/List"
], function (
    util,
    Pragma,
    PragmaList
) {
    "use strict";

    function AST(generator) {
        this.generator = generator;
        this.syntax = null;
    }

    util.extend(AST.prototype, {
        find: function (type, callback) {
            function checkNode(node, parents) {
                var nodes = [node].concat(parents || []);

                if (node.type === type) {
                    callback(node, nodes);
                } else if (node.length) {
                    node.forEach(function (subNode) {
                        checkNode(subNode, nodes);
                    });
                } else if (node.type === "AssignmentExpression" || node.type === "BinaryExpression") {
                    checkNode(node.left, nodes);
                    checkNode(node.right, nodes);
                } else if (node.type === "ExpressionStatement") {
                    checkNode(node.expression, nodes);
                } else if (node.type === "CallExpression") {
                    checkNode(node.arguments, nodes);
                    checkNode(node.callee, nodes);
                } else if (node.type === "Variable") {
                    checkNode(node.arguments, nodes);
                    checkNode(node.callee, nodes);
                }
            }

            checkNode(this.syntax.body, []);
        },

        generate: function () {
            return this.generator.generate(this.syntax);
        },

        getPragmas: function () {
            var pragmas = new PragmaList();

            this.syntax.body.forEach(function (node) {
                if (node.type === "ExpressionStatement" && node.expression.type === "Literal") {
                    pragmas.add(Pragma.fromText(node.expression.value));
                }
            });

            return pragmas;
        },

        getUseStrictPragma: function () {
            return this.getPragmas().find(/^use strict$/)[0];
        },

        parseParserAPISyntax: function (parserAPISyntax) {
            if (!parserAPISyntax || parserAPISyntax.type !== "Program") {
                throw new Error("AST.parseParserAPISyntax() :: Provided syntax object does not match the Mozilla ParserAPI syntax specification");
            }
            this.syntax = parserAPISyntax;
        },

        prehoist: function () {
            var syntax = this.syntax,
                useStrictPragma = this.getUseStrictPragma(),
                variableDeclarations = [],
                functionDeclarations = [],
                index,
                initializers,
                node;

            // Pull out variable declarations, leaving any assignments/initializers in place
            for (index = 0; index < syntax.body.length; index += 1) {
                node = syntax.body[index];

                initializers = [];

                if (node.type === "VariableDeclaration") {
                    node.declarations.forEach(function (declarator) {
                        if (declarator.init) {
                            initializers.push({
                                expression: {
                                    left: declarator.id,
                                    operator: "=",
                                    right: declarator.init,
                                    type: "AssignmentExpression"
                                },
                                type: "ExpressionStatement"
                            });
                        }

                        variableDeclarations.push({
                            id: declarator.id,
                            init: null,
                            type: "VariableDeclarator"
                        });
                    });
                    syntax.body.splice.apply(syntax.body, [index, 1].concat(initializers));
                } else if (node.type === "FunctionDeclaration") {
                    functionDeclarations.push(node);
                    syntax.body.splice(index, 1);
                    index -= 1;
                }
            }

            // Insert declaration for all variables at top
            if (variableDeclarations.length > 0) {
                syntax.body.splice(useStrictPragma ? 1 : 0, 0, {
                    type: "VariableDeclaration",
                    kind: "var",
                    declarations: variableDeclarations
                });
            }
            // Then insert all function declarations
            syntax.body.splice.apply(syntax.body, [useStrictPragma ? 2 : 1, 0].concat(functionDeclarations));
        },

        wrapStatements: function () {
            var useStrictPragma = this.getUseStrictPragma(),
                offset = (useStrictPragma ? 1 : 0);

            function wrapStatement(statement) {
                return {
                    body: statement.type !== "BlockStatement" ? {
                        body: [statement],
                        type: "BlockStatement"
                    } : statement,
                    defaults: [],
                    expression: false,
                    generator: false,
                    id: null,
                    params: [],
                    rest: null,
                    type: "FunctionExpression"
                };
            }

            function makeCall(object, method, argument) {
                return {
                    expression: {
                        arguments: [{ type: "Literal", value: argument }],
                        callee: {
                            computed: false,
                            object: {
                                name: object,
                                type: "Identifier"
                            },
                            property: {
                                name: method,
                                type: "Identifier"
                            },
                            type: "MemberExpression"
                        },
                        type: "CallExpression"
                    },
                    type: "ExpressionStatement"
                };
            }

            function makeBlockStatement(statements) {
                return {
                    body: statements || [],
                    type: "BlockStatement"
                };
            }

            function wrapIfStatement(statementWrappers, statement) {
                var consequentStatements = statement.consequent ? statement.consequent.body : [],
                    consequentLength = consequentStatements.length,
                    alternateStatements = statement.alternate ? statement.alternate.body : [],
                    alternateLength = alternateStatements.length,
                    needsJump = alternateLength > 0;

                statementWrappers.push(wrapStatement({
                    alternate: makeBlockStatement([makeCall("__stepper__", "forward", consequentLength + (needsJump ? 1 : 0))]),
                    consequent: makeBlockStatement(),
                    test: statement.test,
                    type: "IfStatement"
                }));

                util.each(consequentStatements, function (statement, index) {
                    var statements = [statement];

                    // Need to jump past alternate if consequent is executed
                    if (index === consequentLength - 1) {
                        statements.push(makeCall("__stepper__", "forward", alternateLength));
                    }
                    statementWrappers.push(wrapStatement(makeBlockStatement(statements)));
                });

                util.each(alternateStatements, function (statement) {
                    statementWrappers.push(wrapStatement(statement));
                });
            }

            function wrapStatements(block, offset) {
                var body,
                    index,
                    wrapped = 0,
                    statementWrappers = [],
                    statement;

                if (!block || !block.body || !block.body.length) {
                    return;
                }

                body = block.body;
                offset = offset || 0;

                for (index = offset; index < body.length; index += 1) {
                    statement = body[index];

                    if (statement.type === "VariableDeclaration" || statement.type === "FunctionDeclaration") {
                        offset += 1;
                    } else if (statement.type === "IfStatement") {
                        wrapIfStatement(statementWrappers, statement);
                        wrapped += 1;
                    } else {
                        statementWrappers.push(wrapStatement(statement));
                        wrapped += 1;
                    }
                }

                body.splice(offset, wrapped, {
                    argument: {
                        properties: [
                            {
                                key: { name: "evaluator", type: "Identifier" },
                                kind: "init",
                                type: "Property",
                                value: {
                                    body: {
                                        body: [{
                                            argument: {
                                                arguments: [{ name: "expression", type: "Identifier" }],
                                                callee: { name: "eval", type: "Identifier" },
                                                type: "CallExpression"
                                            },
                                            type: "ReturnStatement"
                                        }],
                                        type: "BlockStatement"
                                    },
                                    defaults: [],
                                    expression: false,
                                    generator: false,
                                    id: null,
                                    params: [{ name: "expression", type: "Identifier" }],
                                    rest: null,
                                    type: "FunctionExpression"
                                }
                            },
                            {
                                key: { name: "statementWrappers", type: "Identifier" },
                                kind: "init",
                                type: "Property",
                                value: {
                                    elements: statementWrappers,
                                    type: "ArrayExpression"
                                }
                            }
                        ],
                        type: "ObjectExpression"
                    },
                    type: "ReturnStatement"
                });
            }

            wrapStatements(this.syntax, offset);
        }
    });

    return AST;
});