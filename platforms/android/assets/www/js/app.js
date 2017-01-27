"use strict";

var corsProxy = document.location.hostname == "localhost" ? "../proxy/proxy.php?" : "";
var dateTimeReviver = function (key, value) {
    var a;
    if (typeof value === 'string') {
        a = /\/Date\((-?\d*)\)\//.exec(value);
        if (a) {
            return new Date(+a[1]);
        }
    }
    return value;
};
var utf8_to_b64 = function (str) {
    if (!str) return str;
    return window.btoa(unescape(encodeURIComponent(str)));
};

var b64_to_utf8 = function (str) {
    if (!str) return str;
    return decodeURIComponent(escape(window.atob(str)));
};
var parseMilliSeconds = function(totalMilliSec) {
    var totalSec = totalMilliSec / 1000;
    var hours = parseInt( totalSec / 3600 ) % 24;
    var minutes = parseInt( totalSec / 60 ) % 60;
    var seconds = Math.ceil(totalSec % 60);

    return (hours < 10 ? "0" + hours : hours) + ":" + (minutes < 10 ? "0" + minutes : minutes) + ":" + (seconds  < 10 ? "0" + seconds : seconds)
};

var module = ons.bootstrap('parkline-app', ['onsen', 'timer']);


module.controller('AppController', ['Auth', function(Auth) {

    //check if cordova is loaded
    document.addEventListener('deviceready', function(){
        console.log('[cordova] deviceready');


        document.addEventListener("resume", function(){
            console.log('[cordova] resume');
            Auth.identifyUser();
        }, false);


        if(typeof cordova !== 'undefined'){
            cordova.plugins.backgroundMode.setDefaults({
                title:'Parkline Active',
                text:''
            });
            cordova.plugins.backgroundMode.onactivate = function () {

            };
            cordova.plugins.backgroundMode.ondeactivate = function () {

            }
        }

    }, false);
}]);

module.factory('Auth', [ '$rootScope', '$q', '$http', function($rootScope, $q, $http) {
    var service = {};

    var _accounts = false,
        _activeAccountIndex = 0,
        _activeProductIndex = 0,
        _activeVehicleIndex = 0;

    service.getActiveAccount = function () {
        return this.isLoggedIn() ? _accounts[_activeAccountIndex] : false;
    };
    service.getActiveProduct=function () {
        var account = this.getActiveAccount();
        return (account) ? account.Products[_activeProductIndex] : false;
    };
    service.setActiveVehicle=function (vehicle) {
        var product = this.getActiveProduct();
        var index = product.Identifiers.indexOf(vehicle);
        if (index > 0) {
            _activeVehicleIndex = index;
        }
    };
    service.getActiveVehicle=function () {
        var product = this.getActiveProduct();
        return (product) ? product.Identifiers[_activeVehicleIndex] : false;
    };
    service.isLoggedIn=function () {
        return !!(_accounts);
    };
    service.identifyUser = function () {
        return $q(function (resolve, reject) {
            $http({
                url: corsProxy + "https://webservices.park-line.nl/Phonixx/Mobile/ParkingService.asmx/IdentifyUser?system=1&username=&password=",
                headers: {
                    Accept: "text/html, text/plain, application/json",
                    Username: b64_to_utf8(localStorage.getItem("username")),
                    Password: b64_to_utf8(localStorage.getItem("password")),
                    Country: "NL"
                },
                timeout:20000,
                transformResponse: function (value) {
                    return JSON.parse(value, dateTimeReviver);  //parse Date() strings
                }
            }).success(function (data, status, headers, config) {
                if (data.d && data.d.StatusCode === 1) {
                    console.log("[Auth] identifyUser: success");
                    _accounts = data.d.Accounts;

                    if(typeof cordova !== 'undefined'){
                        var vehicle = service.getActiveVehicle();
                        if(vehicle.Activated) {
                            console.log("[Auth] identifyUser: enable background mode");
                            cordova.plugins.backgroundMode.enable();
                            cordova.plugins.backgroundMode.configure({
                                text:vehicle.ZoneInfo.ZoneCode + ' - ' + vehicle.ZoneInfo.Street
                            });
                        } else {
                            console.log("[Auth] identifyUser: disable background mode");
                            cordova.plugins.backgroundMode.disable();
                        }
                    }
                    resolve();
                } else {
                    console.log("[Auth] identifyUser: fail");
                    _accounts = false;
                    reject(data.d.ErrorDescription);
                }
                $rootScope.$broadcast('auth:updated',service.getActiveVehicle());
            }).error(function(data, status, headers, config) {
                console.log("[Auth] identifyUser: error");
                _accounts = false;
                reject("Connection error");
                $rootScope.$broadcast('auth:updated',service.getActiveVehicle());
            });
        });
    };

    service.startParking = function(){
        return $q(function (resolve, reject) {

            var page = myNavigator.getCurrentPage();
            var zone = page.options.ParkZone;

            var account = service.getActiveAccount();
            var product = service.getActiveProduct();
            var vehicle = service.getActiveVehicle();

            if (!zone || !account || !product || !vehicle){ return }

            $http({
                url:corsProxy +"https://webservices.park-line.nl/Phonixx/Mobile/ParkingService.asmx/ActivateParkingPreAuth?system=1&username=&password=&zoneCode="+zone.ZoneCode+"&productId="+product.Id+"&vehicleId="+vehicle.VehicleId+"&identificationId="+vehicle.Id+"&userId="+account.UserId+"&durationInMinutes=0&cardValidationCode=&preAuthParkingActionId=0",
                headers:{
                    Accept: "text/html, text/plain, application/json",
                    Username: b64_to_utf8(localStorage.getItem("username")),
                    Password: b64_to_utf8(localStorage.getItem("password")),
                    Country:	"NL"
                },
                timeout:20000,
                transformResponse: function(value) {
                    return JSON.parse(value, dateTimeReviver);  //parse Date() strings
                }
            }).success(function(data, status, headers, config) {
                console.log("[Auth] ActivateParkingPreAuth success");
                if(data.d && data.d.StatusCode === 1) {
                    service.identifyUser().then(function(){
                        resolve();
                    });
                } else {
                    reject();
                }
            }).error(function(data, status, headers, config) {
                reject();
            });
        });
    };

    service.stopParking =  function(){
        return $q(function (resolve, reject) {

            var account = service.getActiveAccount();
            var product = service.getActiveProduct();
            var vehicle = service.getActiveVehicle();

            if (!account || !product || !vehicle){ return }

            $http({
                url:corsProxy +"https://webservices.park-line.nl/Phonixx/Mobile/ParkingService.asmx/DeactivateParking?system=1&username=&password=&parkingActionId="+vehicle.ParkingActionID+"&productId="+product.Id+"&vehicleId="+vehicle.VehicleId+"&identificationId="+vehicle.Id+"&userId="+account.UserId,
                headers:{
                    Accept: "text/html, text/plain, application/json",
                    Username: b64_to_utf8(localStorage.getItem("username")),
                    Password: b64_to_utf8(localStorage.getItem("password")),
                    Country:	"NL"
                },
                timeout:20000,
                transformResponse: function(value) {
                    return JSON.parse(value, dateTimeReviver);  //parse Date() strings
                }
            }).success(function(data, status, headers, config) {
                console.log("[Auth] DeactivateParking success");
                if(data.d && data.d.StatusCode === 1) {
                    service.identifyUser().then(function(){
                        resolve();
                    });
                } else {
                    reject();
                }
            }).error(function(data, status, headers, config) {
                reject();
            });
        });
    };

    return service;
}]);

module.factory('Favourite', ['$filter', function($filter){
    var service = {};

    service.addToFavourite = function(zone) {
        if(typeof zone === 'undefined') return;
        var favouriteZonesJson = localStorage.getItem('favouriteZones');
        var favouriteZones = JSON.parse(favouriteZonesJson) || [];
        var found = $filter('filter')(favouriteZones, {'ZoneCode': zone.ZoneCode}, true);
        if (found.length == 0) {
            favouriteZones.push(zone);
            localStorage.setItem('favouriteZones', JSON.stringify(favouriteZones))
        }
    };

    service.removeFromFavourite = function(zone) {
        if(typeof zone === 'undefined') return;
        var favouriteZonesJson = localStorage.getItem('favouriteZones');
        var favouriteZones = JSON.parse(favouriteZonesJson) || [];
        var found = $filter('filter')(favouriteZones, {'ZoneCode': zone.ZoneCode}, true);
        if (found.length > 0) {
            var index = favouriteZones.indexOf(found[0]);
            favouriteZones.splice(index, 1);
            localStorage.setItem('favouriteZones', JSON.stringify(favouriteZones))
        }
    };

    service.isFavourite= function(zone) {
        var favouriteZonesJson = localStorage.getItem('favouriteZones');
        var favouriteZones = JSON.parse(favouriteZonesJson) || [];
        var found = $filter('filter')(favouriteZones, {'ZoneCode': zone.ZoneCode}, true);
        return found.length > 0;
    };

    return service;

}]);


module.factory('Scheduler', ['Auth', function(Auth){
    var service = {};

    var _SchedulerEnabled = false,
        _SchedulerTime = "3",
        _SchedulerInterval,
        _resetActive = false;

    var _SchedulerInterval = setInterval(function(){
        if(!_SchedulerEnabled || !Auth.getActiveVehicle().Activated || _resetActive) return;

        var margin = 60000; // 1 minute
        var currentDiff = (new Date() - Auth.getActiveVehicle().ActivationTime);
//        var maxDiff = 2*60*1000 - margin;
        var maxDiff = parseInt(_SchedulerTime)*60*60*1000 - margin;
        if (currentDiff >= maxDiff){
            console.log("[Scheduler] start parking reset", currentDiff,  maxDiff);
            _resetActive = true;
            Auth.stopParking().then(function(){
                Auth.startParking().then(function(){
                    console.log("[Scheduler] parking reset successful");
                    _resetActive = false;
                }, function(error){
                    console.log("[Scheduler] startParking error");
                    _resetActive = false;
                });
            }, function(error){
                console.log("[Scheduler] stopParking error");
                _resetActive = false;
            });
        } else {
            console.log("[Scheduler] waiting...", currentDiff,  maxDiff);
        }
    }, 30000);

    service.isSchedulerEnabled= function() {
        return _SchedulerEnabled;
    };
    service.setSchedulerEnabled= function(bool) {
        _SchedulerEnabled = bool;
    };
    service.setSchedulerTime= function(time) {
        _SchedulerTime = time;
    };
    service.getSchedulerTime=function() {
        return _SchedulerTime;
    };

    return service;
}]);

module.factory('Parking', function(){
    var parked = false;

    return{
        setParkInstance: function(parkedInstance){
            parked = parkedInstance;
        },
        isParked : function(){
            return(parked)? parked : false;
        }
    }
});

module.controller('PageController', ['$scope', 'Auth', function ($scope, Auth){
    ons.ready(function() {
        console.log("[pageController] ready");

        myNavigator.on('prepush', function(event) {
            var pages = myNavigator.getPages();
            if (!Auth.isLoggedIn() && pages.length > 1) {
                event.cancel();
                console.log('[pageController] reset to page', Auth.isLoggedIn() , pages.length)
                myNavigator.resetToPage(pages[0])
            }
        });
    });
}]);



module.controller('loginController', [ '$scope', '$http', 'Auth', function ($scope, $http, Auth) {

    $scope.showLoginError = function (message) {
        $("#login-error .alert-dialog-content p").html(message);
        $("#login-error").show();
    };

    $scope.hideLoginError = function () {
        $("#login-error").hide();
    };

    //submit
    $scope.login = function () {
        localStorage.setItem("username", utf8_to_b64($("input[type=text]").val()));
        localStorage.setItem("password", utf8_to_b64($("input[type=password]").val()));

        $("#load-login").show();
        Auth.identifyUser().then(function(){
            myNavigator.pushPage("zones.html", { animation: "slide" });
            $("#load-login").hide();
        }, function(ErrorDescription) {
            $scope.showLoginError(ErrorDescription);
            localStorage.removeItem("password");
            $("input[type=password]").val("");
            $("#load-login").hide();
        });
    };

    ons.ready(function(){
        console.log("[loginController] ready");
        var username = b64_to_utf8(localStorage.getItem("username"));
        var password = b64_to_utf8(localStorage.getItem("password"));

        if(username){
            $("input[type=text]").val(username);
        }
        if(password){
            $("input[type=password]").val(password);
        }

        //auto login
        if(username && password){
            $scope.login();
        }
    });
}]);

module.controller('zonesController', [ '$scope', '$http', 'Auth', function ($scope, $http, Auth){

    $scope.listGeoLocation =  function(){

        if(!navigator.geolocation){
          return;
        }

        navigator.geolocation.getCurrentPosition(function(pos){
            var latitude = pos.coords.latitude,
                longitude = pos.coords.longitude;
            $("#load-nearby").show();
            $http({
                url:corsProxy +"https://webservices.park-line.nl/Phonixx/Mobile/ParkingService.asmx/GetNearbyZones?system=1&username=&password=&latitude="+latitude+"&longitude="+longitude+"&limit=5",
                headers:{
                    Accept: "text/html, text/plain, application/json",
                    Username: b64_to_utf8(localStorage.getItem("username")),
                    Password: b64_to_utf8(localStorage.getItem("password")),
                    Country:	"NL"
                },
                timeout:20000
            }).success(function(data, status, headers, config) {
                if(data.d && data.d.StatusCode === 1) {
                    $scope.NearbyZones = data.d.GPSZones;
                    $("#load-nearby").hide();
                }
            });

        }, function(error){
            console.log("[zonesController] unable to get latitude/longtitude")
        });
    };

    $scope.listFavouriteLocation = function(){
        var jsonZones = localStorage.getItem("favouriteZones");
        $scope.FavouriteZones = JSON.parse(jsonZones);
    };

    $scope.listActiveLocation = function(){

        var vehicle = Auth.getActiveVehicle();
        if(!vehicle.Activated){
            delete $scope.ActiveZone;
        }
        else {
            $scope.ActiveZone = vehicle.ZoneInfo;
        }
    };

    $scope.openZone = function(zone){
        console.log("[zonesController] openZone:", zone.ZoneCode);
        myNavigator.pushPage("parking.html", { animation: "slide", ParkZone:zone});
    };

    $scope.$on('auth:updated', function(event, data) {
        $scope.ActiveVehicle = data;
        $scope.listActiveLocation();
    });

    ons.ready(function() {
        console.log("[zonesController] ready");

        $scope.ActiveVehicle = Auth.getActiveVehicle();

        $scope.listActiveLocation();
        $scope.listFavouriteLocation();
        $scope.listGeoLocation();

        if($scope.ActiveVehicle.Activated){
            $scope.openZone($scope.ActiveVehicle.ZoneInfo);
        }

        myNavigator.on('prepop', function(event) {
            $scope.listFavouriteLocation();
            $scope.listActiveLocation();
            $scope.ActiveVehicle = Auth.getActiveVehicle();
        });

    });

}]);


module.controller('parkingController', [ '$scope', '$http', '$timeout', 'Auth', 'Favourite', function ($scope, $http, $timeout, Auth, Favourite){

    $scope.Activated = false;

    $scope.getZoneInformation =  function(){


        var page = myNavigator.getCurrentPage();
        var zone = page.options.ParkZone;

        var account = Auth.getActiveAccount();
        var product = Auth.getActiveProduct();
        var vehicle = Auth.getActiveVehicle();

        if (!zone || !account || !product || !vehicle){ return }

        $scope.ParkZone = zone;
        $scope.IsZoneFavourite = Favourite.isFavourite(zone);

        if(navigator.geolocation){
            navigator.geolocation.getCurrentPosition(function(pos) {
                var crd = pos.coords;
                $scope.CurrentPosition = {latitude:crd.latitude, longitude:crd.longitude};
                $scope.$apply();
            });
        }

        $http({
            url:corsProxy +"https://webservices.park-line.nl/Phonixx/Mobile/ParkingService.asmx/GetZoneInformation?system=1&username=&password=&zoneCode="+zone.ZoneCode+"&userId="+account.UserId+"&productId="+product.Id+"&vehicleId="+vehicle.VehicleId+"&identificationId="+vehicle.Id,
            headers:{
                Accept: "text/html, text/plain, application/json",
                Username: b64_to_utf8(localStorage.getItem("username")),
                Password: b64_to_utf8(localStorage.getItem("password")),
                Country:	"NL"
            },
            timeout:20000,
            transformResponse: function(value) {
                return JSON.parse(value, dateTimeReviver);  //parse Date() strings
            }
        }).success(function(data, status, headers, config) {
            if(data.d) {
                var ParkZoneDetail = data.d;
                ParkZoneDetail.MaxParkingDuration = ParkZoneDetail.MaxParkingDuration == 0 ? ParkZoneDetail.MaxParkingDuration = "N/A" : ParkZoneDetail.MaxParkingDuration
                $scope.ParkZoneDetail = ParkZoneDetail;
            }
        });

    };

    $scope.startParking =  function(){

        $("#load-parkzone").show();
        Auth.startParking().then(function(){
            $("#load-parkzone").hide();
            $scope.Activated = Auth.getActiveVehicle().Activated;
        }, function(Error) {
            $("#load-parkzone").hide();
        });
    };

    $scope.stopParking =  function(){

        $("#load-parkzone").show();
        Auth.stopParking().then(function(){
            $("#load-parkzone").hide();
            $scope.Activated = Auth.getActiveVehicle().Activated;
        }, function(Error) {
            $("#load-parkzone").hide();
        });

    };

    $scope.addToFavourite = function(){
        console.log("[parkingController] addToFavourite");
        Favourite.addToFavourite($scope.ParkZone);
        $scope.IsZoneFavourite = Favourite.isFavourite($scope.ParkZone);
    };

    $scope.removeFromFavourite = function(){
        Favourite.removeFromFavourite($scope.ParkZone);
        $scope.IsZoneFavourite = Favourite.isFavourite($scope.ParkZone);
    };

    $scope.$on('auth:updated', function(event, data) {
        $scope.Activated = data.Activated;
    });

    ons.ready(function() {
        console.log("[parkingController] ready");

        $scope.getZoneInformation();
        $scope.Activated = Auth.getActiveVehicle().Activated;


    });

}]);

module.controller('timerController', [ '$scope', '$timeout', 'Auth', function ($scope, $timeout, Auth){

    $scope.ParkedSince = "00:00:00";
    $scope.DeactivationPeriod = "";
    $scope.Activated = false;
    $scope.onTimeout = function(){
        $scope.Activated = Auth.getActiveVehicle().Activated;
        mytimeout = $timeout($scope.onTimeout,1000);
        if(!$scope.Activated) return;

        var diff = (new Date() - Auth.getActiveVehicle().ActivationTime);
        $scope.ParkedSince = parseMilliSeconds(diff);
        $scope.DeactivationDate = Auth.getActiveVehicle().AutomaticDeactivationTime;
    };

    $scope.stop = function(){
        $timeout.cancel(mytimeout);
    };

    $scope.$on('auth:updated', function(event, data) {
        $scope.Activated = data.Activated;
    });

    var mytimeout = $scope.onTimeout();
}]);


//controller to schedule parking re-start
module.controller('scheduleController', [ '$scope', '$timeout', 'Scheduler', function ($scope, $timeout, Scheduler){

    $scope.SchedulerEnabled = Scheduler.isSchedulerEnabled();
    $scope.SchedulerTime = Scheduler.getSchedulerTime();

    $scope.$watch('SchedulerEnabled', function(newValue, oldValue) {
        Scheduler.setSchedulerEnabled(newValue);
    });

    $scope.$watch('SchedulerTime', function(newValue, oldValue) {
        Scheduler.setSchedulerTime(newValue);
    });

    $scope.closeSchedulePopover = function(time){
        $scope.SchedulerTime = time;
        $("#schedule-popover").hide();
    };

    $scope.openSchedulePopover = function(){
        $("#schedule-popover").show();
    };
}]);