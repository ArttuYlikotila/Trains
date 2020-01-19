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
            // Go through all the stations, find the names of passenger stations, clean the names and push the names to an array
            for (var i = 0; i < stationNames.length; i++) {
               if (stationNames[i].passengerTraffic == true) {
                  var singleStation = stationNames[i].stationName;
                  // Call a function to clean the station name
                  singleStation = removeChars(singleStation);

                  stationsArray.push(singleStation);
                  //console.log(singleStation);
               }
            }
         }
      }
      stationsRequest.open("GET", stationsQuery, true);
      stationsRequest.send();
   }

   // Function that removes unwanted names and chars from the station names
   function removeChars(station) {
      // Remove word "asema" from all names
      station = station.replace(" asema", "");

      // Remove extra letters from Russian stations
      if (station.includes("_") == true) {
         var splitted = station.split("_");
         station = splitted[0];
      }
      
      return station;
   }

   // Request names of all the stations when the page is loaded
   document.getElementById("page").onload = function() {requestStations()};

   // Function that requests data about trains, parses data to JSON and sorts the JSON-data
   function requestTrains(query, trainType) {
      var request = new XMLHttpRequest();
      request.onreadystatechange = function() {
         // If the request for train data succeeds
         if (request.readyState == 4 && request.status == 200) {
            // Parse the responseText of request to JSON 
            trainData = JSON.parse(request.responseText);
            // Call a function to sort the JSON-data of the trains according to the scheduled times
            sortTrainData(trainData, trainType);
            
            //console.log(trainData);
            // Call a function to handle the train data
            handleTrains(trainType);
         }
      }
      request.open("GET", query, true);
      request.send();
   }

   // Function that sorts the JSON-data of trains according to their schedule
   function sortTrainData(trainData, trainType) {
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
   function handleTrains(trainType) {
      var category, trainName, timeTableLength, startingStationCode, finalStationCode, startingStationName, finalStationName, 
      cancelled, scheduledTime, estimatedTime, track;   
      
      // Call a function to clear the correct HTML element of previous data
      clearElement(trainType);
      
      // Loop through the JSON-data of trains to handle all the data
      for (var i = 0; i < trainData.length; i++) {     
         // Start extracting data
         category = trainData[i].trainCategory; 
         timeTableLength = trainData[i].timeTableRows.length;       
         startingStationCode = trainData[i].timeTableRows[0].stationShortCode;
         finalStationCode = trainData[i].timeTableRows[timeTableLength-1].stationShortCode;
         cancelled = trainData[i].cancelled;

         // Call a function to compose the name of the train
         trainName = composeName(trainData, category, i);

         // Call a function to find out the first and the final station of the train
         [startingStationName, finalStationName] = findStations(startingStationCode, finalStationCode, trainType);
         
         // Call a function to find out scheduled and estimated arrival time and if the train is on schedule
         [scheduledTime, estimatedTime, differenceInMinutes, track] = findTimes(trainData, timeTableLength, i, trainType);

         // Call a function to create a HTML element of the train to the web-page
         createTrainElement(trainName, startingStationName, finalStationName, scheduledTime, estimatedTime, track, trainType, cancelled, differenceInMinutes);
      }
   }

   // Function that clears a HTML element depending on the type of the data
   function clearElement(trainType) {
      // Clear the page from previous trains based on the incoming data
      if (trainType == "ARRIVAL") {
         incomingTrainsElement.innerHTML = "";
      }
      else {
         departingTrainsElement.innerHTML = "";
      }
   }

   // Function that composes the name of a single train
   function composeName(trainData, category, i) {
      // Compose name for the train depending on the category of the train
      if (category == "Commuter") {
         return trainName = "Lähijuna " + trainData[i].commuterLineID;
      }
      else {
         return trainName = trainData[i].trainType + " " + trainData[i].trainNumber;
      }
   }

   // Function that searches and returns scheduled and estimated times of arrivals and departures and checks if the train is running in schedule
   // TO-DO there are some anomalies in the data of the API regarding times, at least with trains running late, some workaround possibly needed
   function findTimes(trainData, timeTableLength, i, trainType) {
      var stationCode, scheduledTimeObject, estimatedTimeObject, scheduledTime, estimatedTime, differenceInMinutes;
      // Loop through the timetable of a single train to find scheduled time and estimated time
      for (var j = 0; j < timeTableLength; j++) {
         stationCode = trainData[i].timeTableRows[j].stationShortCode;
         // If the correct station is found, extract scheduled and estimated times and transform them to strings
         if (stationCode == targetStation && trainData[i].timeTableRows[j].type == trainType) {
            scheduledTimeObject = new Date(trainData[i].timeTableRows[j].scheduledTime);
            estimatedTimeObject = new Date(trainData[i].timeTableRows[j].liveEstimateTime);
            scheduledTime = scheduledTimeObject.toLocaleTimeString("en-US", {hour: "2-digit", minute: "2-digit", hour12: false});
            estimatedTime = estimatedTimeObject.toLocaleTimeString("en-US", {hour: "2-digit", minute: "2-digit", hour12: false});
            
            // Retrieve data that tells if the train is on schedule or not
            differenceInMinutes = trainData[i].timeTableRows[j].differenceInMinutes;
            // Retrieve the data about the track reserved for the train in the station
            track = trainData[i].timeTableRows[j].commercialTrack;

            return [scheduledTime, estimatedTime, differenceInMinutes, track];
         }
      }
   }

   // Function that finds out the names of first and the final station of a train
   function findStations(startingStationCode, finalStationCode, trainType) {
      // Call a function to check if the train is going circular line and change the codes accordingly
      [startingStationCode, finalStationCode] = findAirportLine(startingStationCode, finalStationCode, trainType);

      // Find the names of the first and last station of the train from the JSON-data
      for (var j = 0; j < stationNames.length; j++) {
         // Find the name of the first station of the train
         if (startingStationCode == stationNames[j].stationShortCode) {
            var startingStationName = stationNames[j].stationName;
            if (startingStationCode != "LEN") {
               // Call a function to clean the stations name
               startingStationName = removeChars(startingStationName);
            }            
         }
         // Find the the name of the last station of the train
         if (finalStationCode == stationNames[j].stationShortCode) {
            var finalStationName = stationNames[j].stationName;
            if (finalStationCode != "LEN") {
               // Call a function to clean the stations name
               finalStationName = removeChars(finalStationName);
            }
         }
      }
      return [startingStationName, finalStationName];
   }

   // Function that changes the station codes if the train is going circular line
   function findAirportLine(startingStationCode, finalStationCode, trainType) {
      // Change the appropriate station code if the train is the circular line going from Helsinki to Airport and back to Helsinki
      if (startingStationCode == "HKI" && finalStationCode == "HKI") {
         if (trainType == "ARRIVAL") {
            startingStationCode = "LEN";
         }
         else {
            finalStationCode = "LEN";
         }
      }
      return [startingStationCode, finalStationCode];
   }

   // Function that creates a new HTML element for the train
   function createTrainElement(trainName, startingStationName, finalStationName, scheduledTime, estimatedTime, track, trainType, cancelled, differenceInMinutes) {
      var newElement = document.createElement("tr");
      var trainHTML;

      // Pre-format variable for HTML element
      trainHTML = "<td>" + trainName + "</td>" +
                  "<td>" + startingStationName + "</td>" +
                  "<td>" + finalStationName + "</td>"

      // Call a function to add the schedule information of the train depending on trains status
      trainHTML = addScheduleInformation(newElement, trainHTML, cancelled, differenceInMinutes, scheduledTime, estimatedTime)
      
      // Add track information of the train
      trainHTML += "<td>" + track + "</td";

      // Add content to the new HTML element
      newElement.innerHTML = trainHTML;

      // Call a function to append the created new element to the web-page
      addElement(newElement, trainType);
   }

   // Function that adds schedule information to a single train depending on the status of the trains schedule
   function addScheduleInformation(newElement, trainHTML, cancelled, differenceInMinutes, scheduledTime, estimatedTime) {
      // Pre-format variable for HTML element
      var scheduledHTML = "<div id='smaller'>(" + scheduledTime + ")</div>";
      var estimatedHTML;
      
      // If the train is cancelled
      if (cancelled == true) {
         newElement.id = "cancelled";      
         trainHTML += "<td><div id='smaller'>" + scheduledTime + "</div>" +
                     "<div id='red'>Peruttu</div></td>";
      }
      // If the train is running late from the schedule
      else if (differenceInMinutes > 0) {
         estimatedHTML = "<div id='red'>" + estimatedTime + "</div>";
         trainHTML += "<td>" + estimatedHTML + scheduledHTML + "</td>"         
      }
      // If the train is running ahead of schedule
      else if (differenceInMinutes < 0) {
         estimatedHTML = "<div id='faster'>" + estimatedTime + "</div>";
         trainHTML += "<td>" + estimatedHTML + scheduledHTML + "</td>"
      }
      // If the train is running on schedule
      else {         
         trainHTML += "<td>" + scheduledTime + "</td>";
      }

      return trainHTML;
   }

   // Function that appends a new train element to the web-page
   function addElement(newElement, trainType) {
      // Choose the parent element where to append the new element
      if (trainType === "ARRIVAL") {
         incomingTrainsElement.appendChild(newElement);
      }
      else {
         departingTrainsElement.appendChild(newElement);
      }
   }

   // Start the search if the user presses enter
   $(document).keypress(function(e) {
      var keycode = (e.keycode ? e.keycode : e.which);
      
      if (keycode == 13) {
         event.preventDefault();
         composeQuery();
         requestTrains(incomingQuery, "ARRIVAL");
         $('.nav-tabs a[href="#incomingTrainsTab"]').tab('show');
         document.getElementById("searchField").blur();
      }
   });
   
   // Listener that starts the request and handling for departing trains when link is clicked
   document.getElementById("loadDeparting").addEventListener('click', function() {
      requestTrains(departingQuery, "DEPARTURE");
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
            requestTrains(incomingQuery, "ARRIVAL");
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
      incomingQuery =  queryStart + targetStation + "?arriving_trains=" + amountOfTrains + "&arrived_trains=0&departing_trains=0&departed_trains=0&train_categories=Commuter,Long-Distance";
      departingQuery = queryStart + targetStation + "?arriving_trains=0&arrived_trains=0&departing_trains=" + amountOfTrains + "&departed_trains=0&train_categories=Commuter,Long-Distance";
   }
}();