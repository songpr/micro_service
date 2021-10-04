const util = require("../util");


test("replace env", async () => {
    const config_string = `
{
    "config": {
        "config_string": "\${string_env}",
        "config_int": "%{number_env}",
        "config_boolean": "%{boolean_env}"
    }
}`
    process.env.string_env = "test passed";
    process.env.number_env = 100;
    process.env.boolean_env = true;
    const replaced_config = JSON.parse(util.replaceByEnv(config_string));
    expect(replaced_config.config.config_string).toEqual("test passed");
    expect(replaced_config.config.config_int).toBe(100);
    expect(replaced_config.config.config_boolean).toBe(true);
});

test("replace env with default", async () => {
    const config_string = `
{
    "config": {
        "config_string": "\${string_env}",
        "config_int": "%{number_env}",
        "config_boolean": "%{boolean_env}"
    },
    "config_with_default": {
        "config_string": "\${string_noenv|default_string}",
        "config_int": "%{number_noenv|0}",
        "config_boolean": "%{boolean_noenv|false}"
    }
}`
    process.env.string_env = "test passed";
    process.env.number_env = 100;
    process.env.boolean_env = true;
    const replaced_config = JSON.parse(util.replaceByEnv(config_string));
    expect(replaced_config.config.config_string).toEqual("test passed");
    expect(replaced_config.config.config_int).toBe(100);
    expect(replaced_config.config.config_boolean).toBe(true);
    expect(replaced_config.config_with_default.config_string).toEqual("default_string");
    expect(replaced_config.config_with_default.config_int).toBe(0);
    expect(replaced_config.config_with_default.config_boolean).toBe(false);
});