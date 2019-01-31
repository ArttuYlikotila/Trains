const app = function () {
   // Global variables
   // Variables for elements where the trains are shown
   var incomingTrainsElement = document.getElementById("incomingTrainsElement");
   var departingTrainsElement = document.getElementById("departingTrainsElement");
   // Variables for queries
   var incomingQuery;
   var departingQuery;
   // Variables for JSON-data
   var trainData;
   var stationNames;
   // Other variables
   var targetStation;
   var stationsArray = [];

   // Function that requests data about stations, parses data to JSON and pushes the station names to an array
   function requestStations() {
      var stationsQuery = "https://rata.digitraffic.fi/api/v1/metadata/stations";
      var stationsRequest = new XMLHttpRequest();
      stationsRequest.onreadystatechange = function() {
         // If the request for stations succeeds
         if (stationsRequest.readyState == 4 && stationsRequest.status == 200) {
            // Parse the returned data to JSON-format
            stationNames = JSON.parse(stationsRequest.responseText);
            // Go through all the stations and push the names of passenger stations to an array
            for (var i = 0; i < stationNames.length; i++) {
               if (stationNames[i].passengerTraffic == true) {
                  var singleStation = stationNames[i].stationName;
                  // TO-DO check if the remaining odd station names could be fixed
                  var pattern = /asema/i;
                  singleStation = singleStation.replace(pattern, "")
                  stationsArray.push(singleStation);
                  //console.log(singleStation);
               }
            }
         }
      }
      stationsRequest.open("GET", stationsQuery, true);
      stationsRequest.send();
   }

   // Request names of all the stations when the page is loaded
   document.getElementById("page").onload = function() {requestStations()};

   // Function that requests data about trains, parses data to JSON and sorts JSON-data
   function requestTrains(query, trainType, handleTrains) {
      var request = new XMLHttpRequest();
      request.onreadystatechange = function() {
         // If the request for train data succeeds
         if (request.readyState == 4 && request.status == 200) {
            // Parse the responseText of request to JSON 
            trainData = JSON.parse(request.responseText);
            // Call a function to sort the JSON-data of the trains by the scheduled times
            sortTrainData(trainData, trainType);
            
            //console.log(trainData);
            // Call a correct function to handle the train data
            handleTrains(trainType);
         }
      }
      request.open("GET", query, true);
      request.send();
   }

   // Function that sorts the JSON-data of trains according to their schedule
   function sortTrainData (trainData, trainType) {
      trainData.sort(function(a, b){
         var timeA, timeB;
         
         // Go through the data and find the correct times for the wanted station
         for (var i = 0; i < a.timeTableRows.length; i++) {
            if (a.timeTableRows[i].stationShortCode == targetStation && a.timeTableRows[i].type == trainType) {
               timeA = a.timeTableRows[i].scheduledTime;
            }
         }
         for (var i = 0; i < b.timeTableRows.length; i++) {
            if (b.timeTableRows[i].stationShortCode == targetStation && b.timeTableRows[i].type == trainType) {
               timeB = b.timeTableRows[i].scheduledTime;
            }
         }
         // Compare times and return result
         if (timeA == timeB) {
            return 0;
         }
         if (timeA < timeB) {
            return -1;
         }
         if (timeA > timeB) {
            return 1;
         }
      });
   }

   // Function that extracts the wanted data from the JSON-data of incoming trains
   function handleIncomingTrains(trainType) {
      var category, trainName, timeTableLength, startingStationCode, finalStationCode, startingStationName, finalStationName, 
      cancelled, scheduledTime, estimatedTime, differenceToSchedule;   
      // Clear the page from previous trains
      incomingTrainsElement.innerHTML = "";
      
      // Loop through the JSON-data to handle all the trains
      for (var i = 0; i < trainData.length; i++) {
         category = trainData[i].trainCategory;      
         
         // Start extracting data if the category of the train is one of the possible passenger train categories
         if (category == "Long-distance" || category == "Commuter") {
            timeTableLength = trainData[i].timeTableRows.length;       
            startingStationCode = trainData[i].timeTableRows[0].stationShortCode;
            finalStationCode = trainData[i].timeTableRows[timeTableLength-1].stationShortCode;
            cancelled = trainData[i].cancelled;
            
            if (startingStationCode != targetStation || startingStationCode == targetStation && finalStationCode == targetStation) {
               // Call a function to compose the name of the train
               trainName = composeName(trainData, category, i);

               // Call a function to find out scheduled and estimated arrival time and if the train is on schedule
               [scheduledTime, estimatedTime, differenceToSchedule] = findTimes (trainData, timeTableLength, i, trainType);
               
               // Call a function to find out the first and the final station of the train
               [startingStationName, finalStationName] = findStations (trainData, timeTableLength, i);

               // Call a function to create HTML element of the train to the web-page
               createTrainElement(trainName, startingStationName, finalStationName, scheduledTime, estimatedTime, trainType, cancelled, differenceToSchedule);
            }
         }
      }
   }

   // Function that extracts the wanted data from the JSON-data of departing trains
   function handleDepartingTrains(trainType) {
      var category, trainName, timeTableLength, startingStationCode, finalStationCode, startingStationName, finalStationName,
      cancelled, scheduledTime, estimatedTime, differenceToSchedule;
      // Clear the page from previous trains
      departingTrainsElement.innerHTML = "";

      // Loop through the JSON-data to handle all the trains
      for (var i = 0; i < trainData.length; i++) {
         category = trainData[i].trainCategory;      

         // Start extracting data if the train is a passenger train
         if (category == "Long-distance" || category == "Commuter") {
            timeTableLength = trainData[i].timeTableRows.length;       
            startingStationCode = trainData[i].timeTableRows[0].stationShortCode;
            finalStationCode = trainData[i].timeTableRows[timeTableLength-1].stationShortCode;
            cancelled = trainData[i].cancelled;

            if (finalStationCode != targetStation || startingStationCode == targetStation && finalStationCode == targetStation) {
               // Call a function to compose the name of the train
               trainName = composeName(trainData, category, i);
               
               // Call a function to find out scheduled and estimated departure time and if the train is on schedule
               [scheduledTime, estimatedTime, differenceToSchedule] = findTimes (trainData, timeTableLength, i, trainType);

               // Call a function to find out the first and the final station of the train
               [startingStationName, finalStationName] = findStations (trainData, timeTableLength, i);

               // Call a function to create HTML element of the train to the web-page
               createTrainElement(trainName, startingStationName, finalStationName, scheduledTime, estimatedTime, trainType, cancelled, differenceToSchedule);
            }
         }
      }
   }

   // Function to compose the name of a single train
   function composeName (trainData, category, i) {
      // Compose name for the train depending on the category of the train
      if (category == "Commuter") {
         return trainName = "Lähijuna " + trainData[i].commuterLineID;
      }
      else {
         return trainName = trainData[i].trainType + " " + trainData[i].trainNumber;
      }
   }

   // Function that searches and returns scheduled and estimated times of arrivals and departures and checks if the train is running in schedule
   function findTimes (trainData, timeTableLength, i, trainType) {
      var stationCode, scheduledTimeObject, estimatedTimeObject, scheduledTime, estimatedTime, differenceInMinutes, differenceToSchedule;
      // Loop through the timetable of train to find scheduled time and estimated time
      for (var j = 0; j < timeTableLength; j++) {
         stationCode = trainData[i].timeTableRows[j].stationShortCode;
         // If the correct station is found, extract scheduled and estimated times and transform them to strings
         if (stationCode == targetStation && trainData[i].timeTableRows[j].type == trainType) {
            scheduledTimeObject = new Date(trainData[i].timeTableRows[j].scheduledTime);
            estimatedTimeObject = new Date(trainData[i].timeTableRows[j].liveEstimateTime);
            scheduledTime = scheduledTimeObject.toLocaleTimeString("en-US", {hour: "2-digit", minute: "2-digit", hour12: false});
            estimatedTime = estimatedTimeObject.toLocaleTimeString("en-US", {hour: "2-digit", minute: "2-digit", hour12: false});
            
            // Check if the train is late, ahead or running in schedule
            differenceInMinutes = trainData[i].timeTableRows[j].differenceInMinutes;

            if (differenceInMinutes > 0) {
               differenceToSchedule = "late";
            }
            else if (differenceInMinutes < 0) {
               differenceToSchedule = "ahead";
            }
            else {
               differenceToSchedule = "onSchedule";
            }

            return [scheduledTime, estimatedTime, differenceToSchedule];
         }
      }
   }

   // Function to find out the first and the final station of a train
   function findStations (trainData, timeTableLength, i) {
      // Find the names of the first and last station of the train from the JSON-data of stations using UIC-code of the station
      for (var j = 0; j < stationNames.length; j++) {
         // Find the first station of the train
         if (trainData[i].timeTableRows[0].stationUICCode == stationNames[j].stationUICCode) {
            var startingStationName = stationNames[j].stationName;
            startingStationName = startingStationName.replace("asema", "");
         }
         // Find the last station of the train
         if (trainData[i].timeTableRows[timeTableLength-1].stationUICCode == stationNames[j].stationUICCode) {
            var finalStationName = stationNames[j].stationName;
            finalStationName = finalStationName.replace("asema", "");
         }
      }
      return [startingStationName, finalStationName];
   }

   // Function that creates a new HTML element for the train
   function createTrainElement(trainName, startingStationName, finalStationName, scheduledTime, estimatedTime, trainType, cancelled, differenceToSchedule) {
      var newElement = document.createElement("tr");
      var trainHTML;
      // TO-DO the information about the trains difference to schedule should be tested to be sure it works
      // Create a HTML element for the train if the train is cancelled
      if (cancelled == true) {
         newElement.id = "cancelled";      
         trainHTML = "<td>" + trainName + "</td>" +
                     "<td>" + startingStationName + "</td>" +
                     "<td>" + finalStationName + "</td>" + 
                     "<td><div id='smaller'>" + scheduledTime + "</div>" +
                     "<div id='red'>Peruttu</div></td>";
      }
      // If the train is running on schedule
      else if (differenceToSchedule === "onSchedule") {         
         trainHTML = "<td>" + trainName + "</td>" +
                     "<td>" + startingStationName + "</td>" +
                     "<td>" + finalStationName + "</td>" + 
                     "<td>" + scheduledTime + "</td>";
      }
      // If the train is running late from the schedule
      else if (differenceToSchedule === "late") {
         trainHTML = "<td>" + trainName + "</td>" +
                     "<td>" + startingStationName + "</td>" +
                     "<td>" + finalStationName + "</td>" + 
                     "<td><div id='red'>" + estimatedTime + "</div>" +
                     "<div id='smaller'>(" + scheduledTime + ")</div></td>";
      }
      // If the train is running ahead of schedule
      else if (differenceToSchedule === "ahead") {
         trainHTML = "<td>" + trainName + "</td>" +
                     "<td>" + startingStationName + "</td>" +
                     "<td>" + finalStationName + "</td>" + 
                     "<td><div id='faster'>" + estimatedTime + "</div>" +
                     "<div id='smaller'>(" + scheduledTime + ")</div></td>";
      }
      newElement.innerHTML = trainHTML;

      // Choose where to append the new element
      if (trainType === "ARRIVAL") {
         incomingTrainsElement.appendChild(newElement);
      }
      else {
         departingTrainsElement.appendChild(newElement);
      }
   }

   // Start search if the user presses enter
   $(document).keypress(function(e) {
      var keycode = (e.keycode ? e.keycode : e.which);
      
      if (keycode == 13) {
         event.preventDefault();
         composeQuery();
         requestTrains(incomingQuery, "ARRIVAL", handleIncomingTrains);
         $('.nav-tabs a[href="#incomingTrainsTab"]').tab('show');
         document.getElementById("searchField").blur();
      }
   });

   // Listener that starts the request and handling for departing trains when link is clicked
   document.getElementById("loadDeparting").addEventListener('click', function() {
      requestTrains(departingQuery, "DEPARTURE", handleDepartingTrains);
   })

   // Autocomplete for search
   $(function() {
      $(".autocomplete").autocomplete({
         //minLength: 1,
         delay: 300,
         appendTo: "#searchElement",
         source: function(request, response) {
            var matcher = new RegExp("^" + $.ui.autocomplete.escapeRegex(request.term), "i" );
            response($.grep(stationsArray, function(item){
               return matcher.test(item);
            }) );
         },
         select: function(event, ui) {
            $("#searchField").val(ui.item.label);
            composeQuery();
            requestTrains(incomingQuery, "ARRIVAL", handleIncomingTrains);
            $('.nav-tabs a[href="#incomingTrainsTab"]').tab('show');
            document.activeElement.blur();
            $("#searchField").blur();
            return false;
         }
      });
   });

   // Function that composes the search query
   function composeQuery() {
      var queryStart = "https://rata.digitraffic.fi/api/v1//live-trains/station/";
      var success = false;
      targetStation = document.getElementById("searchField").value;
      var regexTarget = new RegExp("^" + targetStation, 'i');
      var amountOfTrains = 15;
      
      // Go through the stations JSON-data in a loop
      for (var i = 0; i < stationNames.length; i++) {
         // If a station is a passenger station
         if (stationNames[i].passengerTraffic == true) {
            // If target station is found, change targetStation to stationShortCode
            if (regexTarget.test(stationNames[i].stationName)) {
               targetStation = stationNames[i].stationShortCode;
               success = true;
               // Break the loop when target is found
               break;
            }
         }
      }
      if (success == false) {
         window.alert("Hakusanalla ei löydetty asemaa.");
      }
      // If the searched station is Helsinki, ask for more trains because of the amount of trafic
      if (targetStation === "HKI") {
         amountOfTrains = 30;
      }
      // Compose the final queries
      incomingQuery =  queryStart + targetStation + "?arriving_trains=" + amountOfTrains + "&arrived_trains=0&departing_trains=0&departed_trains=0";
      departingQuery = queryStart + targetStation + "?arriving_trains=0&arrived_trains=0&departing_trains=" + amountOfTrains +"&departed_trains=0";
   }
}();