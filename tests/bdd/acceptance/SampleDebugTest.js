define([
    "vendor/chai/chai",
    "js/AST",
    "vendor/escodegen/escodegen",
    "js/Stepper"
], function (
    chai,
    AST,
    generator,
    Stepper
) {
    "use strict";

    var expect = chai.expect;

    describe("Sample stepping sessions", function () {
        var ast,
            stepper;

        beforeEach(function () {
            ast = new AST(generator);
            stepper = new Stepper(ast);
        });

        it("should combine two variable declarations into one", function () {
            stepper.parse(function () {
                var a = 1;
                var b = 2;
            });

            stepper.call(null);
            expect(stepper.evaluate("a")).to.equal(undefined);
            expect(stepper.evaluate("b")).to.equal(undefined);
            stepper.step();
            expect(stepper.evaluate("a")).to.equal(1);
            expect(stepper.evaluate("b")).to.equal(undefined);
            stepper.step();
            expect(stepper.evaluate("a")).to.equal(1);
            expect(stepper.evaluate("b")).to.equal(2);
        });

        it("should prehoist variable declarations with one declarator, leaving initializers in place", function () {
            stepper.parse(function () {
                a = 1;
                var a = 2;
                a = 3;
            });

            stepper.call(null);
            expect(stepper.evaluate("a")).to.equal(undefined);
            stepper.step();
            expect(stepper.evaluate("a")).to.equal(1);
            stepper.step();
            expect(stepper.evaluate("a")).to.equal(2);
            stepper.step();
            expect(stepper.evaluate("a")).to.equal(3);
        });

        it("should prehoist variable declarations with two declarators, leaving initializers in place", function () {
            stepper.parse(function () {
                a = 1;
                var a = 2, b = 1;
                a = 3;
            });

            stepper.call(null);
            expect(stepper.evaluate("a")).to.equal(undefined);
            expect(stepper.evaluate("b")).to.equal(undefined);
            stepper.step();
            expect(stepper.evaluate("a")).to.equal(1);
            expect(stepper.evaluate("b")).to.equal(undefined);
            stepper.step();
            expect(stepper.evaluate("a")).to.equal(2);
            expect(stepper.evaluate("b")).to.equal(undefined);
            stepper.step();
            expect(stepper.evaluate("b")).to.equal(1);
        });

        it("should allow a rewind to execute the same statement twice", function () {
            var data = { value: 0 };

            stepper.parse(function (data) {
                data.value += 2;
            });

            stepper.call(null, data);

            expect(data.value).to.equal(0);
            stepper.step();
            expect(data.value).to.equal(2);
            stepper.back();
            stepper.step();
            expect(data.value).to.equal(4);
            stepper.back();
            stepper.step();
            expect(data.value).to.equal(6);
        });

        it("should allow single-stepping through a simple function", function () {
            var data = { value: 0 };

            stepper.parse(function (data) {
                data.value = 1;
                data.value = 2;
                data.value = 3;
            });

            stepper.call(null, data);

            expect(data.value).to.equal(0);
            stepper.step();
            expect(data.value).to.equal(1);
            stepper.step();
            expect(data.value).to.equal(2);
            stepper.step();
            expect(data.value).to.equal(3);
        });

        it("should allow eval in a simple function's scope", function () {
            var data = { value: 0 };

            stepper.parse(function (data) {
                var a = 7;

                data.value = 1;
            });

            stepper.call(null, data);

            stepper.step();
            expect(data.value).to.equal(0);
            stepper.step();
            expect(data.value).to.equal(1);
            expect(stepper.evaluate("a + 1")).to.equal(8);
        });

        it("should support variable declarations if specified", function () {
            var data = { value: 0 };

            stepper.parse(function (data) {
                var a = 7;
            });

            stepper.call(null, data);
            stepper.step();
            expect(stepper.evaluate("a + 2")).to.equal(9);
        });

        it("should skip 'use strict' pragma if specified", function () {
            var data = { value: 0 };

            stepper.parse(function (data) {
                "use strict";
                data.value = 2;
            });

            stepper.call(null, data);
            stepper.step();
            expect(data.value).to.equal(2);
        });

        it("should be able to skip a statement", function () {
            stepper.parse(function () {
                var a = "begin";
                a = "not me!";
                a = "yah me";
            });

            stepper.call(null);
            stepper.step();
            expect(stepper.evaluate("a")).to.equal("begin");
            stepper.forward();
            stepper.step();
            expect(stepper.evaluate("a")).to.equal("yah me");
        });

        it("should treat if (...) test as a statement", function () {
            stepper.parse(function () {
                var a = "to begin";

                if ((a = "assignment") === "assignment") {
                    a = "inside";
                }
            });

            stepper.call(null);
            stepper.step();
            expect(stepper.evaluate("a")).to.equal("to begin");
            stepper.step();
            expect(stepper.evaluate("a")).to.equal("assignment");
            stepper.step();
            expect(stepper.evaluate("a")).to.equal("inside");
        });

        it("should execute the consequent of an if (...) with a truthy test", function () {
            stepper.parse(function () {
                var a = "to begin";

                if (1 === 1) {
                    a = "success";
                } else {
                    a = "failure";
                }

                a = "after";
            });

            stepper.call(null);
            stepper.step();
            expect(stepper.evaluate("a")).to.equal("to begin");
            stepper.step();
            stepper.step();
            expect(stepper.evaluate("a")).to.equal("success");
            stepper.step();
            expect(stepper.evaluate("a")).to.equal("after");
        });

        it("should execute the alternate of an if (...) with a falsy test", function () {
            stepper.parse(function () {
                var a = "to begin";

                if (1 === 2) {
                    a = "success";
                } else {
                    a = "failure";
                }

                a = "after";
            });

            stepper.call(null);
            stepper.step();
            expect(stepper.evaluate("a")).to.equal("to begin");
            stepper.step();
            stepper.step();
            expect(stepper.evaluate("a")).to.equal("failure");
            stepper.step();
            expect(stepper.evaluate("a")).to.equal("after");
        });

        it("should be able to step over a function call in void context", function () {
            stepper.parse(function () {
                var a = "to begin";

                function process() {
                    a = "inside";
                }

                process();

                a = "after";
            });

            stepper.call(null);
            stepper.step();
            expect(stepper.evaluate("a")).to.equal("to begin");
            stepper.step();
            expect(stepper.evaluate("a")).to.equal("inside");
            stepper.step();
            expect(stepper.evaluate("a")).to.equal("after");
        });

        it("should be able to step into a function call in void context", function () {
            stepper.parse(function () {
                var a = "begin";

                function process() {
                    a = "processed 1";
                    a = "processed 2";
                }

                process();

                a = "finished";
            });

            stepper.call(null);
            stepper.step();
            expect(stepper.evaluate("a")).to.equal("begin");
            stepper.stepIn();
            expect(stepper.evaluate("a")).to.equal("begin");
            stepper.step();
            expect(stepper.evaluate("a")).to.equal("processed 1");
            stepper.step();
            expect(stepper.evaluate("a")).to.equal("processed 2");
            stepper.step();
            expect(stepper.evaluate("a")).to.equal("processed 2");
            stepper.step();
            expect(stepper.evaluate("a")).to.equal("finished");
        });
    });
});
