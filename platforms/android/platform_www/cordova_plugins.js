cordova.define('cordova/plugin_list', function(require, exports, module) {
module.exports = [
    {
        "id": "de.appplant.cordova.plugin.background-mode.BackgroundMode",
        "file": "plugins/de.appplant.cordova.plugin.background-mode/www/background-mode.js",
        "pluginId": "de.appplant.cordova.plugin.background-mode",
        "clobbers": [
            "cordova.plugins.backgroundMode",
            "plugin.backgroundMode"
        ]
    },
    {
        "id": "org.apache.cordova.device.device",
        "file": "plugins/org.apache.cordova.device/www/device.js",
        "pluginId": "org.apache.cordova.device",
        "clobbers": [
            "device"
        ]
    }
];
module.exports.metadata = 
// TOP OF METADATA
{
    "org.apache.cordova.geolocation": "0.3.12",
    "de.appplant.cordova.plugin.background-mode": "0.6.4",
    "org.apache.cordova.console": "0.2.13",
    "org.apache.cordova.device": "0.3.0"
};
// BOTTOM OF METADATA
});