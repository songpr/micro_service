const envVarRegex = /\${(.+)}|"%{(.+)}"|d{(.+)}/g;
const localDatetimeRegexp = /^([0-9]{4})-(0?[1-9]|1[0-2])-(0?[1-9]|[1-2][0-9]|3[0-1]) ((2[0-3]|[01][0-9]):[0-5][0-9](:[0-5][0-9](\.[0-9]{3})?)?)?$/
const isoDatetimeRegexp = /^([0-9]{4})-(0?[1-9]|1[0-2])-(0?[1-9]|[1-2][0-9]|3[0-1])T(2[0-3]|[01][0-9]):[0-5][0-9](:[0-5][0-9](\.[0-9]{3})?)?(Z|(\+|-)(1[0-2]|[0][0-9]):[0-5][0-9])$/
/**
 * replace all ${env_var} or "%{env_var}" with conresponse env value
 * @param {*} config_string 
 */
function replaceByEnv(configString) {
    const matchs = configString.matchAll(envVarRegex);
    const configReplacedArray = [];
    let startIndex = 0;
    for (const match of matchs) {
        configReplacedArray.push(configString.substring(startIndex, match.index));
        startIndex = match.index + match[0].length;
        //replace variable and support default value
        const variable = match[1] || match[2] || match[3];
        const varComponents = variable.split("|");
        const value = process.env[varComponents[0]] || (varComponents.length == 2 ? varComponents[1] : undefined);
        if (value == undefined) throw new Error(`No env variable for ${varComponents[0]}`);
        //date value
        if (match[3] != null && parseDate(value) == null) {
            throw new Error(`Invalid date value ${value} for ${varComponents[0]}`);
        }
        configReplacedArray.push(value)//push replaced string
    }
    configReplacedArray.push(configString.substring(startIndex));//last part
    return configReplacedArray.join("");
}
/**
 * iso8601 format e.g. 2021-12-01T01:00Z, 2021-12-01T01:00:59.000Z,2021-12-01T01:00:59.000+07:00
 * local format e.g. 2021-12-01 ,2021-12-01 10:12
 * @returns {Date} return valid date or null if it's invalid format 
 */
function parseDate(dateString) {
    if (typeof (dateString) !== "string" || (isoDatetimeRegexp.exec(dateString) === null && localDatetimeRegexp.exec(dateString) === null)) {
        return null;
    }
    const date = new Date(dateString);
    return (isDate(date) ? date : null)
}
/**
 * Check given date is valid Date instance and is valid date range.
 * @param {*} date 
 * @returns {boolean} true - on is a valid date 
 */
function isDate(date) {
    return (date instanceof Date) && !Number.isNaN(date);
}

exports.replaceByEnv = replaceByEnv
exports.isDate = isDate
exports.parseDate = parseDate
