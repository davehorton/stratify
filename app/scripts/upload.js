/* global Handlebars */
/* global _ */
/* global Ladda */

jQuery(function($){
	'use strict' ;
	var gateways = [] ;
	var uploadTemplateSuccess = Handlebars.compile($('#upload-success-template').html());
	var uploadTemplateFailure = Handlebars.compile($('#upload-error-template').html());
	var watchDogInterval ;
	var latestUploadStatus = { inProgress: false} ;

	//functions
	var startWatchdog = function( callback ) {
		if( watchDogInterval ) {
			return ;
		}
		watchDogInterval = setInterval( function() {
			getStratUploadStatus( function( err, status ){
				if( err ) {
					return console.error('error retrieving upload status: ' + err.responseText) ;
				}
				var notify =  (status.inProgress === true && latestUploadStatus.inProgress === false) || (status.inProgress === false && latestUploadStatus.inProgress === true) ;
				latestUploadStatus = status ;
				if( notify ) {
					callback() ;
				}
			}) ;
		}, 10000) ;
	} ;
	var stopWatchdog = function() {
		if( watchDogInterval ) {
			clearInterval( watchDogInterval ) ;
		}
		watchDogInterval = null ;
	} ;
	var getStratUploadStatus = function( callback ) {
		$.ajax({
			url: '/stratWS/uploadStatusRequest',
			method: 'GET',
			success: function(data){
				callback(null, data) ;
			},
			error: function( jqXHR, response ) {
				callback(response) ;
			}
		}) ;
	} ;
	var toggleUploadInProgress = function() {
		$('#upload-in-progress').toggle('slow') ;
	} ;
	var showUploadAlert = function( reason ) {
		if( reason ) {
			$('#upload-form button[type=submit]').closest('.form-group').append(uploadTemplateFailure({reason: reason})) ;
		}
		else {
			$('#upload-form button[type=submit]').closest('.form-group').append(uploadTemplateSuccess()) ;
		}
		$('#upload-form .alert').show('slow') ;
	} ;
	var removeUploadAlerts = function() {
		$('#upload-form .alert').remove() ;
	} ;
	var refreshGateways = function() {
		$.ajax({
			url: '/stratWS/stratGateway',
			method: 'GET',
			success: function(data){
				var html = '' ;
				gateways = data.sort(function(a,b) {
					var nameA=a.name.toLowerCase(), nameB=b.name.toLowerCase() ;
					if (nameA < nameB) {
						return -1 ;
					}
					if (nameA > nameB) {
						return 1 ;
					}
					return 0 ;
				}) ;
				['#program','#mailer-program'].forEach( function( selector ){
					var select = $(selector) ;
					if( select ) {
						html = '' ;
						gateways.forEach( function( gw ) { html += '<option>' + gw.name + '</option>'; }) ;
						select.find('option[value!="-1"]').remove() ;
						select.append( html) ;
					}
				}) ;
			}
		}) ;
	} ;
	var onClickLeftMenu = function(e) {
		e.preventDefault() ;

		var $a = $(e.target) ;
		if( $a.closest('li').hasClass('active') ){
			return false ;
		}

		$a.closest('ul').find('li').toggleClass('active',false);
		$a.closest('li').addClass('active') ;

		var panel = $a.attr('href') ;
		$('.panel-wrapper > div').hide() ;
		$('.panel-wrapper').find(panel).show() ;
	} ;
	var validateUploadForm = function() {

		//turn on or off error styling
		_.each( ['#upload-file','#program','#csv','#good','#bad','#sfdc'], function(el) {
			var selector = $('#upload-form').find(el) ;
			var value = selector.val() ;
			$(selector).closest('.form-group').toggleClass('has-error', 0 === value.length ) ;
		}) ;

		//enable or disable the submit button 
		if( $('#upload-form .has-error').length > 0 ) {
			$('#upload-form button[type=submit]').attr('disabled','disabled') ;
			$('#upload-form .has-error').find('select').focus() ;
		}
		else {
			$('#upload-form button[type=submit]').removeAttr('disabled') ;
		}
	} ;
	var onSubmitUpload = function (e){
		var self = this ;
		e.preventDefault() ;

		var el = $('#upload-form button[type=submit]')[0] ;
		var l = Ladda.create(el);
		l.start();

		$('#upload-form button[type=submit]').attr('disabled','disabled') ;
		removeUploadAlerts() ;

		getStratUploadStatus( function(err, status){
			if( err ) {
				l.stop() ;
				showUploadAlert('An error was experienced attempting your request.  Please retry your request later.') ;
				$('#upload-form button[type=submit]').removeAttr('disabled') ;
			}
			else {
				if( status.inProgress === true ) {
					l.stop() ;
					latestUploadStatus = status ;
					toggleUploadInProgress(true) ;
					startWatchdog( function() {
						toggleUploadInProgress() ;
						stopWatchdog() ;
					}) ;
					$('#upload-form button[type=submit]').removeAttr('disabled') ;
				}
				else {
					var formData = new FormData($(self)[0]);

					$.ajax({
						url: '/stratWS/uploadStratFile',
						type: 'POST',
						data: formData,
						cache: false,
						contentType: false,
						processData: false,
						success: function (data) {
							l.stop() ;
							if( data.accepted === true ) {
								showUploadAlert() ;
								$('#upload-form')[0].reset() ;
							}
							else {
								showUploadAlert(data.reason) ;
								$('#upload-form button[type=submit]').removeAttr('disabled') ;
							}
						},
						error: function(jqXHR, response) {
							l.stop() ;
							console.log('error: ' + JSON.stringify(response)) ;
							$('#upload-form button[type=submit]').removeAttr('disabled') ;
						}
					});
				}
			}
		}) ;
		console.log('submitting form') ;
		return false ;
	} ;


	//handlers
	$('ul.panel-selector li a').on('click', onClickLeftMenu ) ;
	$('#upload-form').on({
		'change': validateUploadForm,
		'submit': onSubmitUpload
	}) ;
	//initializers
	
	refreshGateways() ;

	getStratUploadStatus( function( err, status ){
		if( !err && status.inProgress === true ) {
			latestUploadStatus = status ;
			toggleUploadInProgress() ;
			startWatchdog( function() {
				toggleUploadInProgress() ;
				stopWatchdog() ;
			}) ;
		}
	}) ;
}) ;