'use strict';

angular.module('angular-amap', [])
    .directive('ngAmap', [function($q) {

      var _defaults = {
         defaultOpts : {
             toolBar: true,
             scaleCtrl: true,
             overviewCtrl: true,
             enableScrollWheelZoom: true,
             showIndoorMap: false,
             zoom: 10
         },
         defaultOfflineOpts : {
             retryInterval: 30000,
             txt: 'OFFLINE'
         }
      };

      var _scriptLoader = function(ak, offlineOpts, callback) {
          var MAP_URL = `http://webapi.amap.com/maps?v=1.3&key=${ak}&callback=amapinit`;

          var aMap = window.aMap;
          if (aMap && aMap.status === 'loading') {
              return aMap.callbacks.push(callback);
          }

          if (aMap && aMap.status === 'loaded') {
              return callback();
          }

          window.aMap = {status: 'loading', callbacks: []};
          window.amapinit = function() {
              window.aMap.status = 'loaded';
              callback();
              window.aMap.callbacks.forEach(cb => cb());
              window.aMap.callbacks = [];
          };

          var createTag = function() {
              var script = document.createElement('script');
              script.type = 'text/javascript';
              script.src = MAP_URL;
              script.onerror = function() {

                  Array.prototype
                      .slice
                      .call(document.querySelectorAll('ng-amap div'))
                      .forEach(function(node) {
                          node.style.opacity = 1;
                      });
                  document.body.removeChild(script);
                  setTimeout(createTag, offlineOpts.retryInterval);
              };
              document.body.appendChild(script);
              var loadPromise = jQuery.Deferred();
              script.onload = function(){
                loadPromise.resolve();
              }
              script.onerror = function(){
                loadPromise.reject();
              }
              return loadPromise;
          };

        return  createTag();
      };

      var _validator = function (prop, desc){
        if (!prop) {
            throw new Error(desc);
        }
      };

      var _offline = {
        divStyle : {
            width: '100%',
            height: '100%',
            backgroundColor: '#E6E6E6',
            position: 'relative',
            opacity: 0
        },
        labelStyle : {
            fontSize: '30px',
            position: 'absolute',
            top: '50%',
            marginTop: 0,
            left: '50%',
            marginLeft: 0
        }
      };

      var _map = {
        createInstance : function(opts, element) {
            // create map instance
            var map = new AMap.Map(element.id, {
                scrollWheel: opts.enableScrollWheelZoom,
                showIndoorMap: opts.showIndoorMap
            });

            // init map, set central location and zoom level
            map.setZoomAndCenter(opts.zoom, new AMap.LngLat(opts.center.longitude, opts.center.latitude));
            if (opts.toolBar) {
                // add navigation control
                map.plugin(['AMap.ToolBar'], function() {
                    map.addControl(new AMap.ToolBar());
                });
            }
            if (opts.scaleCtrl) {
                // add scale control
                map.plugin(['AMap.Scale'], function() {
                    map.addControl(new AMap.Scale());
                });
            }
            if (opts.overviewCtrl) {
                //add overview map control
                map.plugin(['AMap.OverView'], function() {
                    map.addControl(new AMap.OverView());
                });
            }
            return map;
        },
        createMarker : function(marker, pt) {
            return new AMap.Marker({icon: marker.icon, position: pt});
        },
        redrawMarkers : function(map, previousMarkers, opts) {

            angular.forEach(previousMarkers,function(item) {
                AMap.event.removeListener(item.listener);
                item.marker.setMap(null);
            });

            previousMarkers.length = 0;

            if (!opts.markers) {
                return;
            }

            opts.markers.forEach(function(marker) {

                var marker2 = _map.createMarker(marker, new AMap.LngLat(marker.longitude, marker.latitude));

                // add marker to the map
                marker2.setMap(map);
                let previousMarker = {marker: marker2, listener: null};
                previousMarkers.push(previousMarker);

                if (!marker.title && !marker.content) {
                    return;
                }
                let msg = `<p>${marker.title}</p><p>${marker.content}</p>`;
                let infoWindow2 = new AMap.InfoWindow({
                    isCustom: false,
                    autoMove: true,
                    content: msg
                });
                if (marker.width && marker.height) {
                    infoWindow2.setSize(new AMap.Size(marker.width, marker.height));
                }
                previousMarker.listener = AMap.event.addListener(marker2, 'click', function(e) {
                    infoWindow2.open(map, marker2.getPosition());
                });
            });
        }
      };



        return {
            restrict: 'E',
            scope: {
                options: '=',
                ak: '@',
                offline: '=',
                onMapLoaded: '&'
            },
            link: function link($scope, element, attrs) {

                console.log($scope);

                var opts = angular.extend({}, _defaults.defaultOpts, $scope.options);
                var offlineOpts = angular.extend({}, _defaults.defaultOfflineOpts, $scope.offline);
                $scope.offlineWords = offlineOpts.txt;
                _validator($scope.ak, 'akey must not be empty');
                _validator(opts.center, 'options.center must be set');
                _validator(opts.center.longitude, 'options.center.longitude must be set');
                _validator(opts.center.latitude, 'options.center.latitude must be set');
                _validator(attrs.id, 'id cannot be ignored');

                var map;
                var previousMarkers = [];

                var loadPromise = _scriptLoader($scope.ak, offlineOpts, function () {

                    map = _map.createInstance(opts, element[0]);

                    $scope.onMapLoaded({ map: map });
                    loadPromise.then(function(){
                      //create markers
                      previousMarkers = [];
                      $scope.watchInit();
                      _map.redrawMarkers(map, previousMarkers, opts);
                    });

                });



                $scope.watchInit = function(){
                  $scope.$watch('options.center', function (newValue, oldValue) {
                    if(map){
                      opts = $scope.options;
                      map.setZoomAndCenter(opts.zoom, new AMap.LngLat(opts.center.longitude, opts.center.latitude));
                      _map.redrawMarkers(map, previousMarkers, opts);
                    }
                  }, true);

                  $scope.$watch('options.markers', function (newValue, oldValue) {
                    _map.redrawMarkers(map, previousMarkers, opts);
                  }, true);

                  $scope.$watch('options.zoom', function (newValue, oldValue) {
                    if(map){
                      map.setZoom(newValue);
                    }
                  }, true);
                };



                $scope.divStyle = _offline.divStyle;
                $scope.labelStyle = _offline.labelStyle;

                setTimeout(function () {
                    var $label = document.querySelector('ng-amap div label');
                    $scope.labelStyle.marginTop = $label.clientHeight / -2 + 'px';
                    $scope.labelStyle.marginLeft = $label.clientWidth / -2 + 'px';
                    $scope.$apply();
                });
            },
            template: '<div ng-style="divStyle"><label ng-style="labelStyle">{{ offlineWords }}</label></div>'
        }
      }]
  );
