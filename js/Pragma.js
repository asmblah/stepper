define([
    "js/util"
], function (
    util
) {
    "use strict";

    function Pragma(text) {
        this.text = text;
    }

    util.extend(Pragma, {
        fromText: function (text) {
            return new Pragma(text);
        }
    });

    util.extend(Pragma.prototype, {
        getText: function () {
            return this.text;
        }
    });

    return Pragma;
});
