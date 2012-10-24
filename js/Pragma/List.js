define([
    "js/util"
], function (
    util
) {
    "use strict";

    function PragmaList() {
        this.pragmas = [];
    }

    util.extend(PragmaList.prototype, {
        add: function (pragma) {
            this[this.pragmas.length] = pragma;
            this.pragmas.push(pragma);
        },

        find: function (regex) {
            var pragmas = new PragmaList();

            this.pragmas.forEach(function (pragma) {
                if (regex.test(pragma.getText())) {
                    pragmas.add(pragma);
                }
            });

            return pragmas;
        }
    });

    return PragmaList;
});