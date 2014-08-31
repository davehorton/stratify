/* global Handlebars */
/* global _ */
/* global Ladda */

jQuery(function($){
	'use strict' ;

	var resultsRowTemplate = Handlebars.compile($('#results-tr-template').html());
	var summaryRowTemplate = Handlebars.compile($('#summary-tr-template').html());
	var mailerAlertTemplate = Handlebars.compile($('#mailer-alert-template').html());

	var serverData = [] ;

	var clearMerge = function() {
		$('#results tbody tr').not('.default').remove() ;
		$('#results tbody tr.default').show();

		$('#results input[name=select-all]').prop('checked', false) ;
		$('#summary tbody tr').not('.default').remove() ;
		$('#summary tbody tr.default').show();

		$('#summary span.count').html('0') ;

		$('#do-merge button[type=submit]').attr('disabled','disabled') ;

		$('input[name=sfdc-drop]').attr('disabled','disabled') ;

		$('#zipcode-search input[type=search]').attr('disabled','disabled') ;

		clearPrepAlert() ;
		clearMailerAlert() ;

	} ;
	var clearMailerAlert = function() {
		$('#do-merge .form-messages').remove() ;
	} ;
	var showMailerAlert = function( type, msg ) {
		clearMailerAlert() ;
		var html = mailerAlertTemplate({
			type: type,
			msg: msg
		}) ;
		$('#do-merge').append( html ) ;
	} ;
	var clearPrepAlert = function() {
		$('#mailer-prep .form-messages').remove() ;
	} ;
	var showPrepAlert = function( type, msg ) {
		clearPrepAlert() ;
		var html = mailerAlertTemplate({
			type: type,
			msg: msg
		}) ;
		$('#mailer-prep').append( html ) ;
	} ;
	var setupMerge = function(data) {
		serverData = _.groupBy( data, 'zipcode') ;
		console.log('setupMerge: grouped results: ' + JSON.stringify(serverData)) ;

		$('#results tbody tr.default').hide();

		var obj = {zip: [] } ;
		_.each( _.keys(serverData), function(zip) {
			obj.zip.push({
				zipcode: zip,
				zipcodeOccurrences: serverData[zip].length
			});
		}) ;


		var html = resultsRowTemplate(obj) ;
		$('#results tbody').append( html ) ;

		$('input[name=sfdc-drop]').removeAttr('disabled') ;
		$('#zipcode-search input[type=search]').removeAttr('disabled') ;

	} ;
	var validateMailerPrep = function() {

		var disable = _.find( ['#mailing-number','#state','#mailer-program'], function(el) {
			var value = $(el).val() ;
			return !value || -1 === parseInt(value) ;
		}) ;
		console.log('disable: ' + JSON.stringify(disable)) ;

		//enable or disable the submit button 
		if( disable) {
			$('#mailer-prep button[type=submit]').attr('disabled','disabled') ;
		}
		else {
			$('#mailer-prep button[type=submit]').removeAttr('disabled') ;
		}
	} ;
	var onSubmitMailerPrep = function() {
		var el = $('#mailer-prep button[type=submit]')[0] ;
		var l = Ladda.create(el);
		l.start();

		clearMerge() ;

		$.ajax({
			url: '/stratWS/getMailerRecords',
			type: 'GET',
			data: {
				program: $('#mailer-program').val(),
				state: $('#state').val(),
				mailingNumber: $('#mailing-number').val(),
				max: $('input[name=max-letters]').val()
			},
			success: function (data) {
				l.stop() ;
				if( data.length === 0 ) {
					showPrepAlert('danger', '<p>No records found.</p>' ) ;
				}
				else {
					setupMerge(data) ;
				}
			},
			error: function(jqXHR, response) {
				l.stop() ;
				serverData = [] ;
				showPrepAlert('danger','<p>Server error.  Please try again later</p>') ;
				console.error('error: ' + JSON.stringify(response)) ;
			}
		}) ;
		return false ;
	} ;
	var onSelectAllRows = function(e) {
		var checked = $(e.target).prop('checked') ;
		$('#results tbody input[type=checkbox]').prop('checked', checked) ;

		if( checked ) {
			//enable letter count entry, default to max, update list of selected zips, and enable the merge button
			$('#results tbody input[type=number]').removeAttr('disabled') ;
		}
		else {

			//disable letter count entry, set total count to zero, clear list of zips and disable merge button
			$('#results tbody input[type=number]').val('').attr('disabled','disabled') ;
			$('#do-merge button[type=submit').attr('disabled','disabled') ;
		}
		updateSummary() ;
	} ;
	var onSelectRow = function (e) {
		if( $(e.target).attr('type') !== 'checkbox') {
			return ;
		}

		var checked = $(e.target).prop('checked') ;
		var tr = $(e.target).closest('tr');
		if( checked ) {
			tr.find('input[type=number]').removeAttr('disabled');
			var max = parseInt( tr.find('td:nth-child(2)').html() );
			tr.find('input[type=number]').val(max) ;
		}
		else {
			tr.find('input[type=number]').val('').attr('disabled','disabled');
		}
		updateSummary() ;
	} ;
	var updateSummary = function() {
		var total = 0 ;
		var obj = { zip:[] } ;

		$('#results tbody tr').each( function() {
			if( $(this).hasClass('default') || !$(this).find('td input[type=checkbox]').prop('checked') ) {
				return ;
			}

			obj.zip.push( $(this).find('td:first-child').html() );

			var count$ = $(this).find('input[type=number]') ;

			//if letter count hasn't been set, set it equal to the max
			if( count$.val() === '' ) {
				var max = parseInt( $(this).find('td:nth-child(2)').html() );
				count$.val(max) ;
			}
			total += parseInt( count$.val() );
		}) ;
		$('#summary span.count').html(total) ;

		$('#summary tbody tr[class!=default]').remove() ;
		if( total > 0 ) {
			$('#summary tbody tr.default').hide() ;
		}
		else {
			$('#summary tbody tr.default').show() ;

		}
		$('#summary tbody').append( summaryRowTemplate(obj)  );
		checkMergeState() ;
	} ;
	var checkMergeState = function() {
		var readyToMerge = true ;
		if( $('#do-merge input[name=sfdc-drop]').val().length === 0 ||
			parseInt( $('#summary span.count').html() ) === 0 ) {
			readyToMerge = false ;
		}

		if( readyToMerge ) {
			$('#do-merge button[type=submit]').removeAttr('disabled') ;
		}
		else {
			$('#do-merge button[type=submit]').attr('disabled','disabled') ;
		}
	} ;
	var onEditSfdcDrop = function() {
		checkMergeState() ;
	} ;
	var onSubmitMailer = function() {
		clearMailerAlert() ;

		var el = $('#do-merge button[type=submit]')[0] ;
		var l = Ladda.create(el);
		l.start();

		$('#do-merge button[type=submit]').attr('disabled','disabled') ;

		var id = [] ;
		$('#results tbody tr').each( function() {
			if( !$(this).hasClass('default')  && $(this).find('td input[type=checkbox]').prop('checked') ) {
				var zip = $(this).find('td:first-child').html() ;
				var num = $(this).find('td:nth-child(3) input').val() ;
				var ids = _.pluck( serverData[zip], 'id').slice(0, num) ;
				Array.prototype.push.apply( id, ids ) ;
			}
		}) ;

		$.ajax({
			url: '/stratWS/generateMailerFile',
			type: 'POST',
			data: {
				id: id.join(','),
				sfdcDrop: $('input[name=sfdc-drop]').val()
			},
			success: function (data) {
				l.stop() ;
				if( data.accepted === true ) {
					clearMerge() ;
					showMailerAlert('success','<p><strong>Success!</strong> Mailing file was successfully generated.</p>');
				}
				else {
					showMailerAlert('danger','<p>' + data.reason + '</p>') ;
				}
			},
			error: function(jqXHR) {
				l.stop() ;
				console.error('error: ' + JSON.stringify(jqXHR.statusText)) ;
				var msg = 'The server experienced a problem creating the mailing.  Please try again later.' ;
				if( jqXHR.status === 503 ) {
					msg = 'The server is currently down or unreachable' ;
				}
				showMailerAlert('danger',msg) ;
			}
		}) ;
		return false ;
	} ;
	var onZipcodeFilter = function (e) {
		var zip = $(e.target).find('input[type=search]').val() ;
		console.log('filter on ' + zip) ;

		$('#results tbody tr').each( function() {
			if( $(this).hasClass('default') ) {
				return ;
			}
			if( zip.length === 0 || $(this).find('td:first-child').html().indexOf(zip) === 0 ) {
				$(this).show() ;
			}
			else {
				$(this).hide() ;
			}
		}) ;

		return false ;
	} ;
	var onMailerProgramSelect = function () {
		$('#state').focus() ;
	} ;
	var onStateSelect = function () {
		$('#mailing-number').focus() ;
	} ;
	var onChangeResults = function (e) {
		//only interested in changes to the letter count here
		if( $(e.target).attr('type') === 'number') {
			updateSummary() ;
		}
	} ;

	$('#mailer-prep').change(validateMailerPrep) ;
	$('#mailer-prep').submit(onSubmitMailerPrep) ;
	$('#results input[name=select-all]').click(onSelectAllRows) ;
	$('#results tbody').click(onSelectRow) ;
	$('#results tbody').change(onChangeResults) ;
	$('#do-merge input[name=sfdc-drop]').keyup( onEditSfdcDrop) ;
	$('#do-merge').submit( onSubmitMailer ) ;
	$('#zipcode-search').submit( onZipcodeFilter ) ;
	$('#mailer-program').change(onMailerProgramSelect) ;
	$('#state').change(onStateSelect) ;

	
}) ;