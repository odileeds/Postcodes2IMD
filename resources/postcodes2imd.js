/*!
 * ODI Leeds Postcodes to IMD decile (version 1.0)
 *
 * TO DO:
 */
S(document).ready(function(){

	// Main function
	function Postcodes2IMD(file){

		this.version = "1.0";

		this.logging = true;
		this.log = new Logger({'id':'Postcodes2IMD','logging':this.logging,'logtime':true});
		this.messages = [];
		this.data = {};
		this.postcodes = {};

		// If we provided a filename we load that now
		if(file) S().ajax(file,{'complete':this.parsePostcodes,'this':this,'cache':false});

		S('#save').on('click',{me:this},function(e){
			e.data.me.save();
		});

		var _obj = this;

		// Setup the dnd listeners.
		var dropZone = document.getElementById('drop_zone');
		dropZone.addEventListener('dragover', dropOver, false);
		dropZone.addEventListener('dragout', dragOff, false);

		document.getElementById('standard_files').addEventListener('change', function(evt){
			return _obj.handleFileSelect(evt,'csv');
		}, false);

		S('#reset').on('click',{me:this},function(e){
			e.preventDefault();
			e.data.me.reset();
		});

		S('#input').on('change',{me:this},function(e){
			d = 'Postcode\n'+e.currentTarget.value;
			e.data.me.parsePostcodes(d,{'url':'','data':CSVToArray(d)});
		});

		/*S('#step1').append('<p><button id="example" class="c14-bg">Load example</button> (<a href="https://datamillnorth.org/dataset/business-rates">14/01/2019   Leeds City Council Business Rates data from Data Mill North</a>)</p>');
		S('#example').on('click',{me:this},function(e){
			e.preventDefault();
			e.data.me.loadExample();
		});*/

		this.buildMessages();
		return this;
	}
	
	Postcodes2IMD.prototype.reset = function(){
		S('#step1').css({'display':''});
		S('#drop_zone').removeClass('loaded');
		S('#filedetails').remove();
		S('#input')[0].value = '';
		delete this.csv;
		delete this.attr;
		delete this.data;
		delete this.records;
		delete this.csv;
		delete this.file;
		this.messages = [];
		this.changes = 0;
		this.buildMessages();
		
		return this;
	};

	Postcodes2IMD.prototype.loadExample = function(){
		file = "https://datamillnorth.org/download/business-rates/8822678c-f472-467d-9166-48d72ffc7231/Data%20Mill%2014-01-2019.csv";
		S().ajax(file,{
			"this":this,
			"cache":true,
			"success":function(d,attr){
				this.parsePostcodes(d,{'url':attr.url,'data':CSVToArray(d)});
			},
			"error": function(e,attr){
				this.log.error('Unable to load '+attr.url,e,attr);
			}
		});
		return this;
	};

	// Return an HTML select box for the data types
	Postcodes2IMD.prototype.buildSelect = function(typ,row,col){
		var html = '<select id="'+row+'-'+col+'" data-row="'+row+'" data-col="'+col+'">';
		for(var t = 0; t < this.datatypes.length; t++) html += "<option"+(this.datatypes[t].label == typ ? " selected=\"selected\"":"")+" value=\""+this.datatypes[t].label+"\">"+this.datatypes[t].label+"</option>";
		html += "</select>";
		return html;
	};
	
	// Return an HTML true/false select box
	Postcodes2IMD.prototype.buildTrueFalse = function(yes,row,col){
		var html = '<select id="'+row+'-'+col+'" data-row="'+row+'" data-col="'+col+'">';
		html += '<option'+(yes ? " selected=\"selected\"":"")+' value="true">True</option>';
		html += '<option'+(!yes ? " selected=\"selected\"":"")+' value="false">False</option>';
		html += "</select>";
		return html;
	};
	
	// Parse the CSV file
	Postcodes2IMD.prototype.parsePostcodes = function(data,attr){

		this.csv = data;
		this.attr = attr;
		var i,pc,ok;
		
		// Convert the CSV to a JSON structure
		this.data = Array2JSON(attr.data);
		this.records = this.data.rows.length; 
		for(i = 0; i < this.data.fields.name.length; i++){
			if(this.data.fields.name[i].toLowerCase()=="postcode"){
				this.data.postcodecolumn = i;
			}
		}
		if(this.data.postcodecolumn < 0){
			this.log.error('No postcode column provided');
			return;
		}

		// Regex for postcodes 
		var validpostcode = new RegExp(/^([Gg][Ii][Rr] 0[Aa]{2})|((([A-Za-z][0-9]{1,2})|(([A-Za-z][A-Ha-hJ-Yj-y][0-9]{1,2})|(([A-Za-z][0-9][A-Za-z])|([A-Za-z][A-Ha-hJ-Yj-y][0-9][A-Za-z]?))))\s?[0-9][A-Za-z]{2})$/);

		this.data.postcodes = [];
		var postcodeareas = {};
		this.messages = [];

		for(i = 0; i < this.records; i++){
			if(this.data.rows[i][this.data.postcodecolumn]){
				// Remove leading/trailing spaces
				this.data.rows[i][this.data.postcodecolumn] = this.data.rows[i][this.data.postcodecolumn].replace(/(^ | $)/g,"");
				// Check if this seems to be a valid postcode
				match = this.data.rows[i][this.data.postcodecolumn].match(validpostcode);
				ok = false;
				pc = this.data.rows[i][this.data.postcodecolumn];
				if(match){
					for(var m = 0; m < match.length; m++){
						if(match[m] == pc){
							// Valid postcode
							ok = true;
						}
					}
				}
				if(ok){
					// Remove spaces
					this.data.postcodes.push(pc.replace(/ /g,""));
					// Now we need to find the postcode areas e.g. LS, BD, M etc and load those files if we haven't
					pc.replace(/^[A-Z]{1,2}/,function(m){ postcodeareas[m] = true; });
				}else{
					this.messages.push({'type':'warning','title':pc+' does not seem to be a valid postcode on record '+(i+1)});
				}
			}
		}

		// Now load postcode area files
		this.toload = 0;
		this.loaded = 0;
		for(var area in postcodeareas){
			if(postcodeareas[area] && !this.postcodes[area]){
				this.toload++;
			}
		}
		for(var area in postcodeareas){
			if(postcodeareas[area] && !this.postcodes[area]){
				S().ajax("postcodes/"+area+".csv",{
					"this": this,
					"area": area,
					"success": function(d,attr){
						var i,imd,pc,pcs;
						pcs = CSVToArray(d);
						this.postcodes[attr.area] = {};
						for(i = 0; i < pcs.length; i++){
							imd = (parseInt(pcs[i][1])||0);	// Convert deciles to numbers
							pc = pcs[i][0].replace(/ /g,"")	// Remove spaces
							this.postcodes[attr.area][pc] = { 'imd': imd, 'postcode': pcs[i][0] };
						}
						this.loaded++;
						if(this.toload==this.loaded) this.buildChart();
					},
					"error": function(e,attr){
						this.log.error('Unable to load '+attr.url);
					}
				});
			}
		}
		if(this.toload==0) this.buildChart();

		if(this.changes > 0) this.messages.push({'type':'message','title':'Made '+this.changes+' change'+(this.changes == 1 ? "":"s")});
		this.buildMessages();
		
		return;
	};
	
	Postcodes2IMD.prototype.buildChart = function(){
		this.log.time('buildChart');

		var deciles = new Array(10);
		var found = new Array(this.data.postcodes.length);
		for(var i = 0; i < deciles.length; i++) deciles[i] = 0;
		for(var i = 0; i < this.data.postcodes.length; i++) found[i] = false;
		for(var i = 0; i < this.data.postcodes.length; i++){
			// Now we need to find the postcode areas e.g. LS, BD, M etc and load those files if we haven't
			area = "";
			this.data.postcodes[i].replace(/^[A-Z]{1,2}/,function(m){ area = m; });
			if(area){
				pc = this.data.postcodes[i];
				if(this.postcodes[area][pc]){
					d = this.postcodes[area][pc].imd-1;
					if(!deciles[d]) deciles[d] = 0;
					deciles[d]++;
					found[i] = true;
				}
			}
		}
		
		for(var i = 0; i < found.length; i++){
			if(!found[i]) this.messages.push({'type':'message','title':'Unable to find '+this.data.postcodes[i]+' at record '+(i+1)});
		}

		S('#contents').html('<div id="barchart"></div>');
				

		// Define the data
		var data = new Array(deciles.length);
		for(var i = 0; i < deciles.length; i++) data[i] = ["Decile "+(i+1),deciles[i]];
		
		// Create the barchart object
		var chart = new S.barchart('#barchart');

		// Add the data and draw the chart
		chart.setData(data).setBins().draw();

		// Display information on hover events
		chart.on('barover',function(e){
			S('.balloon').remove();
			S(e.event.currentTarget).find('.bar').append(
				'<div class="balloon">'
				+ (this.bins[e.bin].key)+': '
				+ (this.bins[e.bin].value).toFixed(2).replace(/\.?0+$/,"")
				+ '</div>'
			);
		}).on('mouseleave',function(e){
			S('.balloon').remove();
		});
		
		this.buildMessages();

	
		return this;
	}
	
	function convertDates(data,c,typ){
		var r,max;
		var dates = [];
		var tests = [];
		var message = "";
		if(!typ) typ = "datetime";
		// Try to identify date format
		for(r = 0; r < data.rows.length; r++){
			data.rows[r][c].replace(/^([0-9]+)[\/\-]([0-9]+)[\/\-]([0-9]+)(.*)/,function(m,p1,p2,p3,p4){
				dates[r] = {'a':parseInt(p1),'b':parseInt(p2),'c':parseInt(p3),'t':p4};
				tests.push(parseInt(p1));
			});
		}
		max = Math.max(...tests);
		var converted = 0;
		if(max > 12 && max <= 31){
			for(r = 0; r < data.rows.length; r++){
				if(data.rows[r][c]){
					data.rows[r][c] = dates[r].c+'-'+(dates[r].b < 10 ?"0":"")+dates[r].b+'-'+(dates[r].a < 10 ?"0":"")+dates[r].a;
					if(typ=="datetime" && dates[r].t){
						dates[r].h = 0;
						dates[r].m = 0;
						dates[r].s = 0;
						dates[r].t.replace(/([0-9]{1,2})[^0-9]+([0-9]{2})[^0-9]+([0-9]{2}?)/,function(m,p1,p2,p3){ dates[r].h = parseInt(p1); dates[r].m = parseInt(p2); dates[r].s = parseInt(p3); });
						data.rows[r][c] += 'T'+(dates[r].h < 10 ?"0":"")+dates[r].h+':'+(dates[r].m < 10 ?"0":"")+dates[r].m+(dates[r].s ? ':'+(dates[r].s < 10 ?"0":"")+dates[r].s:'');
					}
					converted++;
				}
			}
			if(converted > 0) message = 'Converted '+converted+' dates from British date format to ISO8601';
		}else if(max <= 12){
			for(r = 0; r < data.rows.length; r++){
				if(data.rows[r][c]) data.rows[r][c] = dates[r].c+'-'+(dates[r].a < 10 ?"0":"")+dates[r].a+'-'+(dates[r].b < 10 ?"0":"")+dates[r].b;
			}
			if(converted > 0) message = 'Converted '+converted+' dates from American date format to ISO8601';
		}else if(max > 1000){
			message = "";
		}
		return {'message':message,'data':data,'count':converted};
	}

	Postcodes2IMD.prototype.buildMessages = function(){
		var html = "";
		var i;
		if(this.messages.length > 0){
			for(i = 0; i < this.messages.length; i++){
				sym = "";
				if(this.messages[i]['type']=="warning") sym = "⚠️";
				html += '<li>'+sym+this.messages[i].title+'</li>';
			}
			if(html) html = '<ol>'+html+'</ol>';
			S('#message-holder').css({'display':''});
		}else{
			S('#message-holder').css({'display':'none'});
		}
		S('#messages').html(html);
		return this;
	};
	
	Postcodes2IMD.prototype.findGeography = function(){
return this;
		var x = -1;
		var y = -1;

		var convertfromosgb = false;
		for(var c = 0; c < this.data.fields.title.length; c++){
			// Deal with X coordinate
			if(this.data.fields.title[c].toLowerCase() == "longitude") x = c;
			if(x < 0 && (this.data.fields.title[c].toLowerCase() == "lon" || this.data.fields.title[c].toLowerCase() == "long")) x = c;
			if(x < 0 && this.data.fields.title[c].toLowerCase() == "geox") x = c;
			if(x < 0 && (this.data.fields.title[c].toLowerCase() == "easting" || this.data.fields.title[c].toLowerCase() == "eastings")){
				x = c;
				convertfromosgb = true;
			}
			// Deal with Y coordinate
			if(this.data.fields.title[c].toLowerCase() == "latitude") y = c;
			if(y < 0 && this.data.fields.title[c].toLowerCase() == "lat") y = c;
			if(y < 0 && this.data.fields.title[c].toLowerCase() == "geoy") y = c;
			if(y < 0 && (this.data.fields.title[c].toLowerCase() == "northing" || this.data.fields.title[c].toLowerCase() == "northings")){
				y = c;
				convertfromosgb = true;
			}			
		}

		this.data.geo = new Array(this.data.rows.length);
		this.geocount = 0;
		var crs = -1;
		for(var c = 0; c < this.data.fields.title.length; c++){
			if(this.data.fields.title[c] == "CoordinateReferenceSystem") crs = c;
		}		

		if(x >= 0 && y >= 0){
			for(var i = 0; i < this.data.rows.length; i++){
				lat = this.data.rows[i][y];
				lon = this.data.rows[i][x];
				if(lat!="" && lon!=""){
					ll = [];
					if(crs >= 0){
						if(typeof this.data.rows[i][crs]==="string" && this.data.rows[i][crs].toLowerCase() == "osgb36"){
							ll = NEtoLL([lon,lat]);
						}
					}
					if(convertfromosgb) ll = NEtoLL([lon,lat]);
					if(ll.length == 2){
						lat = ll[0];
						lon = ll[1];				
					}
					if(lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180){
						this.data.geo[i] = [parseFloat(parseFloat(lon).toFixed(6)), parseFloat(parseFloat(lat).toFixed(6))];
						this.geocount++;
					}
				}else{
					this.data.geo[i] = [];
				}
			}
		}

		return this;
	};

	
	// Construct the HTML table
	Postcodes2IMD.prototype.buildTable = function(){

		// Create the data table
		var thead = "";
		var tbody = "";
		var csv = "";
		var csvhead = "";
		var mx = Math.min(this.data.rows.length,this.maxrowstable);

		if(S('#output-table').length==0){

			S('#contents').html('<p id="about-table"></p><div id="output-table" class="table-holder"><table><thead></thead><tbody></tbody></table></div>');
		}
		thead += '<tr><th>Title:</th>';

		for(var c in this.data.fields.name){
			thead += '<th><input id="title-'+c+'" type="text" value="'+this.data.fields.title[c]+'" data-row="title" data-col="'+c+'" /></th>';
			if(csvhead) csvhead += ',';
			csvhead += this.data.fields.title[c];
		}

		thead += '</tr>';
		thead += '<tr><th>Type:</th>';
		for(var c in this.data.fields.name){
			thead += '<th>'+this.buildSelect(this.data.fields.format[c],"format",c)+'</th>';
		}
		thead += '</tr>';

		thead += '<tr><th>Keep?</th>';
		for(var c in this.data.fields.name){
			thead += '<th class="constraint"><label></label>'+this.buildTrueFalse(this.data.fields.required[c],"required",c)+'<!--<button class="delete" title="Remove this constraint from this column">&times;</button><button class="add" title="Add a constraint to this column">&plus;</button>--></th>';
		}
		thead += '</tr>';

		S('#output-table thead').html(thead);

		S('#contents select').on('change',{me:this},function(e,i){
			var el = document.getElementById(e.currentTarget.id);
			var value = el.options[el.selectedIndex].value;
			e.data.me.update(e.currentTarget.id,value);
		});
		S('#contents input').on('change',{me:this},function(e,i){
			e.data.me.update(e.currentTarget.id,e.currentTarget.value);
		});

		
		if(!this.geocount) this.geocount = 0;
		S('#about-table').html("We loaded <em>"+this.records+" records</em> (only showing the first "+mx+" in the table).");

		// Convert dates to ISO format
		for(var c = 0; c < this.data.rows[0].length; c++){
			if(this.data.fields.format[c]=="datetime" && this.rules.clean && this.rules.clean.isodates){
				tmp = convertDates(this.data,c);
				if(tmp.message){
					this.data = tmp.data;
					this.messages.push({'type':'warning','title':tmp.message+' in <em>'+this.data.fields.title[c]+'</em>'});
					this.changes += tmp.count;
				}
			}
		}


		// Build example table
		if(!this.data.geo) this.data.geo = [];
		for(var i = 0; i < mx; i++){
			tbody += '<tr><td class="rn">'+(i+1)+'</td>';
			for(var c = 0; c < this.data.rows[i].length; c++){
				tbody += '<td '+(this.data.fields.format[c] == "float" || this.data.fields.format[c] == "integer" || this.data.fields.format[c] == "year" || this.data.fields.format[c] == "date" || this.data.fields.format[c] == "datetime" ? ' class="n"' : '')+'>';
				tbody += (typeof this.data.rows[i][c]==="string" ? this.data.rows[i][c]:this.data.rows[i][c]);
				tbody += '</td>';
			}
			tbody += '</tr>';
		}
		S('#output-table tbody').html(tbody);

		
		
		for(var r = 0; r < this.data.rows.length; r++){
			for(var c = 0; c < this.data.rows[r].length; c++){
				if(c > 0) csv += ',';
				if(this.data.fields.format[c]=="string"){
					comma = false;
					if(this.data.rows[r][c].indexOf(",") >= 0) comma = true;
					if(comma) csv += "\"";
					if(this.rules && this.rules.clean && this.rules.clean.escapenewlines) csv += this.data.rows[r][c].replace(/[\n\r]+/g,'\\n');
					else csv += this.data.rows[r][c];
					if(comma) csv += "\"";
				}else{
					csv += this.data.rows[r][c];
				}
			}
			csv += "\n";
		}
		this.csv = csvhead+'\n'+csv;
		S('#csvcontents').html(this.csv);
		
		//S('.step2').removeClass('processing').addClass('checked');

		return this;
	};

	// Process a form element and update the data structure
	Postcodes2IMD.prototype.update = function(id,value){

		var el = S('#'+id);
		var row = el.attr('data-row');
		var col = el.attr('data-col');
		if(row == "title") this.data.fields.title[col] = value;
		if(row == "format") this.data.fields.format[col] = value;
		if(row == "required") this.data.fields.required[col] = (value.toLowerCase() == "true" ? true : false);

		// Go through form elements and update the format/constraints
		if(row == "title") this.findGeography();
		
		this.buildTable();

		return this;
	};
			
	Postcodes2IMD.prototype.save = function(){

		// Bail out if there is no Blob function
		if(typeof Blob!=="function") return this;

		var textFileAsBlob = new Blob([this.csv], {type:'text/plain'});
		if(!this.file) this.file = "data.csv";
		var fileNameToSaveAs = this.file.substring(0,this.file.lastIndexOf("."))+".csv";

		function destroyClickedElement(event){ document.body.removeChild(event.target); }

		var dl = document.createElement("a");
		dl.download = fileNameToSaveAs;
		dl.innerHTML = "Download File";
		if(window.webkitURL != null){
			// Chrome allows the link to be clicked
			// without actually adding it to the DOM.
			dl.href = window.webkitURL.createObjectURL(textFileAsBlob);
		}else{
			// Firefox requires the link to be added to the DOM
			// before it can be clicked.
			dl.href = window.URL.createObjectURL(textFileAsBlob);
			dl.onclick = destroyClickedElement;
			dl.style.display = "none";
			document.body.appendChild(dl);
		}
		dl.click();
		S('.step3').addClass('checked');

		return this;
	};

	Postcodes2IMD.prototype.handleFileSelect = function(evt,typ){

		evt.stopPropagation();
		evt.preventDefault();
		dragOff();

		var files;
		if(evt.dataTransfer && evt.dataTransfer.files) files = evt.dataTransfer.files; // FileList object.
		if(!files && evt.target && evt.target.files) files = evt.target.files;

		var _obj = this;
		if(typ == "csv"){

			// files is a FileList of File objects. List some properties.
			var output = "";
			for (var i = 0, f; i < files.length; i++) {
				f = files[i];

				this.file = f.name;
				// ('+ (f.type || 'n/a')+ ')
				output += '<div id="filedetails"><strong>'+ (f.name)+ '</strong> - ' + niceSize(f.size) + ', last modified: ' + (f.lastModifiedDate ? f.lastModifiedDate.toLocaleDateString() : 'n/a') + '</div>';

				// DEPRECATED as not reliable // Only process csv files.
				//if(!f.type.match('text/csv')) continue;

				var start = 0;
				var stop = f.size - 1; //Math.min(100000, f.size - 1);

				var reader = new FileReader();

				// Closure to capture the file information.
				reader.onloadend = function(evt) {
					if (evt.target.readyState == FileReader.DONE) { // DONE == 2
						if(stop > f.size - 1){
							var l = evt.target.result.regexLastIndexOf(/[\n\r]/);
							result = (l > 0) ? evt.target.result.slice(0,l) : evt.target.result;
						}else result = evt.target.result;

						// Render table
						_obj.parsePostcodes(result,{'url':f.name,'data':CSVToArray(result)});
					}
				};
				
				// Read in the image file as a data URL.
				//reader.readAsText(f);
				var blob = f.slice(start,stop+1);
				reader.readAsText(blob);
			}
			//document.getElementById('list').innerHTML = '<p>File loaded:</p><ul>' + output.join('') + '</ul>';
			S('#drop_zone').append(output).addClass('loaded');

		}
		return this;
	};
	
	/**
	 * https://www.bennadel.com/blog/1504-ask-ben-parsing-csv-strings-with-javascript-exec-regular-expression-command.htm
	 * CSVToArray parses any String of Data including '\r' '\n' characters,
	 * and returns an array with the rows of data.
	 * @param {String} CSV_string - the CSV string you need to parse
	 * @param {String} delimiter - the delimeter used to separate fields of data
	 * @returns {Array} rows - rows of CSV where first row are column headers
	 */
	function CSVToArray (CSV_string, delimiter) {
	   delimiter = (delimiter || ","); // user-supplied delimeter or default comma

	   var pattern = new RegExp( // regular expression to parse the CSV values.
		 ( // Delimiters:
		   "(\\" + delimiter + "|\\r?\\n|\\r|^)" +
		   // Quoted fields.
		   "(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" +
		   // Standard fields.
		   "([^\"\\" + delimiter + "\\r\\n]*))"
		 ), "gi"
	   );

	   var rows = [[]];  // array to hold our data. First row is column headers.
	   // array to hold our individual pattern matching groups:
	   var matches = false; // false if we don't find any matches
	   // Loop until we no longer find a regular expression match
	   while (matches = pattern.exec( CSV_string )) {
		   var matched_delimiter = matches[1]; // Get the matched delimiter
		   // Check if the delimiter has a length (and is not the start of string)
		   // and if it matches field delimiter. If not, it is a row delimiter.
		   if (matched_delimiter.length && matched_delimiter !== delimiter) {
			 // Since this is a new row of data, add an empty row to the array.
			 rows.push( [] );
		   }
		   var matched_value;
		   // Once we have eliminated the delimiter, check to see
		   // what kind of value was captured (quoted or unquoted):
		   if (matches[2]) { // found quoted value. unescape any double quotes.
			matched_value = matches[2].replace(
			  new RegExp( "\"\"", "g" ), "\""
			);
		   } else { // found a non-quoted value
			 matched_value = matches[3];
		   }
		   // Now that we have our value string, let's add
		   // it to the data array.
		   rows[rows.length - 1].push(matched_value);
	   }
	   return rows; // Return the parsed data Array
	}

	// Function to parse a 2D array and return a JSON structure
	// Guesses the format of each column based on the data in it.
	function Array2JSON(data){

		var line,datum,header,types;
		var newdata = new Array();
		var formats = new Array();
		var req = new Array();
		var start = 1;
		var r,c,isdate;
		header = data[0];

		for(r = 0, rows = 0 ; r < data.length; r++){

			datum = new Array(data[r].length);
			types = new Array(data[r].length);

			// Loop over each column in the line
			for(c = 0; c < data[r].length; c++){
				
				// Remove any quotes around the column value
				datum[c] = data[r][c].replace(/^\"(.*)\"$/,function(m,p1){ return p1; });

				isdate = false;
				if(datum[c].search(/[0-9]{2}[\/\- ][0-9]{2}[\/\- ][0-9]{4}/) >= 0) isdate = true;
				if(!isNaN(Date.parse(datum[c]))) isdate = true;
				// If the value parses as a float
				if(typeof parseFloat(datum[c])==="number" && parseFloat(datum[c]) == datum[c]){
					types[c] = "float";
					// Check if it is actually an integer
					if(typeof parseInt(datum[c])==="number" && parseInt(datum[c])+"" == datum[c]){
						types[c] = "integer";
						// If it is an integer and in the range 1700-2100 we'll guess it is a year
						if(datum[c] >= 1700 && datum[c] < 2100) types[c] = "year";
					}
				}else if(datum[c].search(/^(true|false)$/i) >= 0){
					// The format is boolean
					types[c] = "boolean";
				}else if(datum[c].search(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&\/\/=]*)/) >= 0){
					// The value looks like a URL
					types[c] = "URL";
				}else if(isdate){
					// The value parses as a date
					types[c] = "datetime";
				}else{
					// Default to a string
					types[c] = "string";
					// If the string value looks like a time we set it as that
					if(datum[c].search(/^[0-2]?[0-9]\:[0-5][0-9]$/) >= 0) types[c] = "time";
				}
			}
			if(r == 0 && start > 0) header = datum;
			if(r >= start){
				newdata[rows] = datum;
				formats[rows] = types;
				rows++;
			}
		}
		
		// Now, for each column, we sum the different formats we've found
		var format = new Array(header.length);
		for(var j = 0; j < header.length; j++){
			var count = {};
			var empty = 0;
			for(var i = 0; i < newdata.length; i++){
				if(!newdata[i][j]) empty++;
			}
			for(var i = 0 ; i < formats.length; i++){
				if(!count[formats[i][j]]) count[formats[i][j]] = 0;
				count[formats[i][j]]++;
			}
			var mx = 0;
			var best = "";
			for(var k in count){
				if(count[k] > mx){
					mx = count[k];
					best = k;
				}
			}
			// Default
			format[j] = "string";

			// If more than 80% (arbitrary) of the values are a specific format we assume that
			if(mx >= 0.8*newdata.length) format[j] = best;

			// If we have a few floats in with our integers, we change the format to float
			if(format[j] == "integer" && count['float'] > 0.1*newdata.length) format[j] = "float";

			req.push(header[j] ? true : false);
		}

		// Return the structured data
		return { 'fields': {'name':header,'title':clone(header),'format':format,'required':req }, 'rows': newdata };
	}
	// Function to clone a hash otherwise we end up using the same one
	function clone(hash) {
		var json = JSON.stringify(hash);
		var object = JSON.parse(json);
		return object;
	}

	function dropOver(evt){
		evt.stopPropagation();
		evt.preventDefault();
		S(this).addClass('drop');
	}
	function dragOff(){ S('.drop').removeClass('drop'); }

	String.prototype.regexLastIndexOf = function(regex, startpos) {
		regex = (regex.global) ? regex : new RegExp(regex.source, "g" + (regex.ignoreCase ? "i" : "") + (regex.multiLine ? "m" : ""));
		if(typeof (startpos) == "undefined") {
			startpos = this.length;
		} else if(startpos < 0) {
			startpos = 0;
		}
		var stringToWorkWith = this.substring(0, startpos + 1);
		var lastIndexOf = -1;
		var nextStop = 0;
		while((result = regex.exec(stringToWorkWith)) != null) {
			lastIndexOf = result.index;
			regex.lastIndex = ++nextStop;
		}
		return lastIndexOf;
	}

	function niceSize(b){
		if(b > 1e12) return (b/1e12).toFixed(2)+" TB";
		if(b > 1e9) return (b/1e9).toFixed(2)+" GB";
		if(b > 1e6) return (b/1e6).toFixed(2)+" MB";
		if(b > 1e3) return (b/1e3).toFixed(2)+" kB";
		return (b)+" bytes";
	}

	function Logger(inp){
		if(!inp) inp = {};
		this.logging = (inp.logging||false);
		this.logtime = (inp.logtime||false);
		this.id = (inp.id||"JS");
		this.metrics = {};
		return this;
	}
	Logger.prototype.error = function(){ this.log('ERROR',arguments); };
	Logger.prototype.warning = function(){ this.log('WARNING',arguments); };
	Logger.prototype.info = function(){ this.log('INFO',arguments); };
	Logger.prototype.message = function(){ this.log('MESSAGE',arguments); }
	Logger.prototype.log = function(){
		if(this.logging || arguments[0]=="ERROR" || arguments[0]=="WARNING" || arguments[0]=="INFO"){
			var args,args2,bold;
			args = Array.prototype.slice.call(arguments[1], 0);
			bold = 'font-weight:bold;';
			if(console && typeof console.log==="function"){
				if(arguments[0] == "ERROR") console.error('%c'+this.id+'%c: '+args[0],bold,'',args);
				else if(arguments[0] == "WARNING") console.warn('%c'+this.id+'%c: '+args[0],bold,'',args);
				else if(arguments[0] == "INFO") console.info('%c'+this.id+'%c: '+args[0],bold,'',args);
				else console.log('%c'+this.id+'%c: '+args[0],bold,'',args);
			}
		}
		return this;
	}
	Logger.prototype.time = function(key){
		if(!this.metrics[key]) this.metrics[key] = {'times':[],'start':''};
		if(!this.metrics[key].start) this.metrics[key].start = new Date();
		else{
			var t,w,v,tot,l,i,ts;
			t = ((new Date())-this.metrics[key].start);
			ts = this.metrics[key].times;
			// Define the weights for each time in the array
			w = [1,0.75,0.55,0.4,0.28,0.18,0.1,0.05,0.002];
			// Add this time to the start of the array
			ts.unshift(t);
			// Remove old times from the end
			if(ts.length > w.length-1) ts = ts.slice(0,w.length);
			// Work out the weighted average
			l = ts.length;
			this.metrics[key].av = 0;
			if(l > 0){
				for(i = 0, v = 0, tot = 0 ; i < l ; i++){
					v += ts[i]*w[i];
					tot += w[i];
				}
				this.metrics[key].av = v/tot;
			}
			this.metrics[key].times = ts.splice(0);
			if(this.logtime) this.info(key+' '+t+'ms ('+this.metrics[key].av.toFixed(1)+'ms av)');
			delete this.metrics[key].start;
		}
		return this;
	};

	// Define a new instance of the Converter
	convertor = new Postcodes2IMD();
	
});

var convertor;