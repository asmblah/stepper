define([
    "modular"
], function (
    modular
) {
    "use strict";

    var util;

    util = modular.extend({}, modular.util, {
        filter: function (list) {
            var index,
                item,
                length = list.length,
                result = [];

            for (index = 0; index < length; index += 1) {
                item = list[index];

                if (item !== "") {
                    result.push(item);
                }
            }

            return result;
        }
    });

    return util;
});
