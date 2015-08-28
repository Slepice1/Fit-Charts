(function () {
  'use strict';

  var app = angular.module('examples', ['chart.js', 'ui.bootstrap', 'angular-google-gapi']);
  moment.locale('cs');

  app.config(function (ChartJsProvider) {
    // Configure all charts
    ChartJsProvider.setOptions({
      colours: ['#97BBCD', '#DCDCDC', '#F7464A', '#46BFBD', '#FDB45C', '#949FB1', '#4D5360'],
      responsive: true
    });
    // Configure all doughnut charts
    ChartJsProvider.setOptions('Doughnut', {
      animateScale: true
    });
  });

  app.run(['GAuth', 'GApi',
    function(GAuth, GApi) {

      var CLIENT = '579107654082-i5482okutdblqj21el366ehrsjosm06h.apps.googleusercontent.com';

      GApi.load('fitness','v1');

      GAuth.setClient(CLIENT);
      GAuth.setScope("https://www.googleapis.com/auth/fitness.activity.read");

    }
  ]);

  app.service('FitService',['GApi', function (GApi) {
    var getNanosec = function (time) {
      return time.valueOf() * 1000000;
    };
    var loadDataForTimespan = function (from, to, dataType, success, error) {
      var fromNanosec = getNanosec(from).toString();
      var toNanosec = getNanosec(to).toString();
      GApi.executeAuth('fitness', 'users.dataSources.datasets.get',
                      {'userId': 'me', 'dataSourceId': dataType,
                       'datasetId': fromNanosec + '-' + toNanosec}).then(
        function(resp) {
          if (resp.result.point !== null || resp.result.point !== "undefined") {
            success(resp.result.point);
          }
          else {
            error("No data for this timespan");
          }
      },function() {
          error("Couldn't load data");
      });
    };
    var dataOperations = function (sumForDuration, values, last) {
      values[0].push(sumForDuration);

      var avgSum = 0;
      values[0].forEach( function (point) {
        avgSum += point;
      });
      var avg = avgSum/values[0].length;
      values[1].push(avg);

      if (last) {
        values[2][0] = avg;
        values[2].push(avg);
      } else {
        values[2].push(null);
      }
    };
    var parseData = function (from, to, duration, data) {

      var values = [[],[], []];
      var series = ['Steps','Changing Avg', 'Avg'];
      var labels = [];

      labels.push(from.date())
      var nextDuration = from.add(duration);

      var sumForDuration = 0;
      for (var point in data) {
        if (parseInt(data[point].startTimeNanos) > getNanosec(nextDuration)) {
          dataOperations(sumForDuration, values, false);

          sumForDuration = data[point].value[0].intVal;

          labels.push(nextDuration.format('D.M'));
          nextDuration = nextDuration.add(duration);
        }
        else {
          sumForDuration += data[point].value[0].intVal;
        }
      }
      dataOperations(sumForDuration, values, true);

      return {data: values, labels: labels, series: series}
    };
    var getData = function (from, to, duration, dataType, success, error) {
      var data = loadDataForTimespan(from, to, dataType, function(data) {
        var toReturn = parseData(from, to, duration, data)
        success(toReturn);
      },
      function(e) {
        error();
      });
    };

    return {
       getData: getData
    };
  }]);

  app.controller('MenuCtrl', function ($scope) {
    $scope.isCollapsed = true;
    $scope.charts = ['Line', 'Bar', 'Doughnut', 'Pie', 'Polar Area', 'Radar', 'Base'];
  });

  app.controller('LineCtrl', function ($scope, $timeout, FitService, GApi, GAuth) {

    $scope.today = function() {
      $scope.dt = new Date();
    };
    $scope.today();

    $scope.clear = function () {
      $scope.dt = null;
    };

    // Disable weekend selection
    $scope.disabled = function(date, mode) {
      return ( mode === 'day' && ( date.getDay() === 0 || date.getDay() === 6 ) );
    };

    $scope.toggleMin = function() {
      $scope.minDate = $scope.minDate ? null : new Date();
    };
    $scope.toggleMin();

    $scope.open = function($event) {
      $scope.status.opened = true;
    };

    $scope.dateOptions = {
      formatYear: 'yy',
      startingDay: 1
    };

    $scope.format = 'dd.MM.yyyy';

    var tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    var afterTomorrow = new Date();
    afterTomorrow.setDate(tomorrow.getDate() + 2);
    $scope.events =
      [
        {
          date: tomorrow,
          status: 'full'
        },
        {
          date: afterTomorrow,
          status: 'partially'
        }
      ];

    $scope.getDayClass = function(date, mode) {
      if (mode === 'day') {
        var dayToCheck = new Date(date).setHours(0,0,0,0);

        for (var i=0;i<$scope.events.length;i++){
          var currentDay = new Date($scope.events[i].date).setHours(0,0,0,0);

          if (dayToCheck === currentDay) {
            return $scope.events[i].status;
          }
        }
      }

      return '';
    };

    $scope.status = {
       opened: false
    };

    $scope.date = {};
    $scope.data = [[null]];
    $scope.series = ['Steps'];
    $scope.labels= [null];
    $scope.onClick = function (points, evt) {
      console.log(points, evt);
    };
    $scope.onHover = function (points) {
      if (points.length > 0) {
        console.log('Point', points[0].value);
      } else {
        console.log('No point');
      }
    };

    $scope.waitForApi = function () {
      GAuth.checkAuth().then(
        function () {
          var dataType = 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps';
          FitService.getData(moment().subtract(1, 'month').startOf('month').startOf('day'),
                           moment().subtract(1, 'month').endOf('month').endOf('day'),
                           moment.duration(1, 'day'),
                           dataType,
                           function (data) {
                            $scope.data = data.data;
                            $scope.labels = data.labels;
                            $scope.series = data.series;
                           },
                           function (e) {
                            $scope.data = [[]];
                           });
        },
        function() {
          $timeout(function () {$scope.waitForApi()},1000);
        });
    };

    $scope.getGraphData = function () {
      $scope.waitForApi();
    };
    $scope.getGraphData();
  });

  app.controller('BarCtrl', ['$scope', '$timeout', function ($scope, $timeout) {
    $scope.options = { scaleShowVerticalLines: false };
    $scope.labels = ['2006', '2007', '2008', '2009', '2010', '2011', '2012'];
    $scope.series = ['Series A', 'Series B'];
    $scope.data = [
      [65, 59, 80, 81, 56, 55, 40],
      [28, 48, 40, 19, 86, 27, 90]
    ];
    $timeout(function () {
      $scope.options = { scaleShowVerticalLines: true };
    }, 3000);
  }]);

  app.controller('DoughnutCtrl', ['$scope', '$timeout', function ($scope, $timeout) {
    $scope.labels = ['Download Sales', 'In-Store Sales', 'Mail-Order Sales'];
    $scope.data = [0, 0, 0];

    $timeout(function () {
      $scope.data = [350, 450, 100];
    }, 500);
  }]);

  app.controller('PieCtrl', function ($scope) {
    $scope.labels = ['Download Sales', 'In-Store Sales', 'Mail Sales'];
    $scope.data = [300, 500, 100];
  });

  app.controller('PolarAreaCtrl', function ($scope) {
    $scope.labels = ['Download Sales', 'In-Store Sales', 'Mail Sales', 'Telesales', 'Corporate Sales'];
    $scope.data = [300, 500, 100, 40, 120];
  });

  app.controller('BaseCtrl', function ($scope) {
    $scope.labels = ['Download Sales', 'Store Sales', 'Mail Sales', 'Telesales', 'Corporate Sales'];
    $scope.data = [300, 500, 100, 40, 120];
    $scope.type = 'PolarArea';

    $scope.toggle = function () {
      $scope.type = $scope.type === 'PolarArea' ?  'Pie' : 'PolarArea';
    };
  });

  app.controller('RadarCtrl', function ($scope) {
    $scope.labels = ['Eating', 'Drinking', 'Sleeping', 'Designing', 'Coding', 'Cycling', 'Running'];

    $scope.data = [
      [65, 59, 90, 81, 56, 55, 40],
      [28, 48, 40, 19, 96, 27, 100]
    ];

    $scope.onClick = function (points, evt) {
      console.log(points, evt);
    };
  });

  app.controller('StackedBarCtrl', function ($scope) {
    $scope.labels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    $scope.type = 'StackedBar';

    $scope.data = [
      [65, 59, 90, 81, 56, 55, 40],
      [28, 48, 40, 19, 96, 27, 100]
    ];
  });

  app.controller('DataTablesCtrl', function ($scope) {
    $scope.labels = ['January', 'February', 'March', 'April', 'May', 'June', 'July'];
    $scope.data = [
      [65, 59, 80, 81, 56, 55, 40],
      [28, 48, 40, 19, 86, 27, 90]
    ];
    $scope.colours = [
      { // grey
        fillColor: 'rgba(148,159,177,0.2)',
        strokeColor: 'rgba(148,159,177,1)',
        pointColor: 'rgba(148,159,177,1)',
        pointStrokeColor: '#fff',
        pointHighlightFill: '#fff',
        pointHighlightStroke: 'rgba(148,159,177,0.8)'
      },
      { // dark grey
        fillColor: 'rgba(77,83,96,0.2)',
        strokeColor: 'rgba(77,83,96,1)',
        pointColor: 'rgba(77,83,96,1)',
        pointStrokeColor: '#fff',
        pointHighlightFill: '#fff',
        pointHighlightStroke: 'rgba(77,83,96,1)'
      }
    ];
    $scope.randomize = function () {
      $scope.data = $scope.data.map(function (data) {
        return data.map(function (y) {
          y = y + Math.random() * 10 - 5;
          return parseInt(y < 0 ? 0 : y > 100 ? 100 : y);
        });
      });
    };
  });

  app.controller('LoginCtrl', ['$rootScope', '$scope', 'GAuth', 'GApi',
      function myController($rootScope, $scope, GAuth, GApi) {

      $scope.doLogin = function() {
          GAuth.login().then(function(){
            console.log('login success');
          }, function() {
            console.log('login fail');
          });
        };
      }
  ]);
})();
