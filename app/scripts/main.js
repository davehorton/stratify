jQuery(function($){
	
	var gateways = [] ;
	var uploadTemplateSuccess = Handlebars.compile($('#upload-success-template').html());
	var uploadTemplateFailure = Handlebars.compile($('#upload-error-template').html());
	var watchDogInterval ;
	var latestUploadStatus = { inProgress: false} ;

	$('.datepicker').datepicker() ;


	//functions
	function startWatchdog( callback ) {
		if( watchDogInterval ) return ;
		watchDogInterval = setInterval( function() {
			getStratUploadStatus( function( err, status ){
				if( err ) return console.error('error retrieving upload status: ' + err.responseText) ;
				var notify =  (status.inProgress === true && latestUploadStatus.inProgress === false) || (status.inProgress === false && latestUploadStatus.inProgress === true) ;
				latestUploadStatus = status ;
				notify && callback() ;
			}) ;
		}, 10000) ;
	}
	function stopWatchdog() {
		watchDogInterval && clearInterval( watchDogInterval ) ;
		watchDogInterval = null ;
	}
	function getStratUploadStatus( callback ) {
		$.ajax({
			url: '/stratWS/uploadStatusRequest'
			,method: 'GET'
			,success: function(data){
				callback(null, data) ;
			}
			,error: function( jqXHR, response, errorThrown) {
				callback(response) ;
			}
		}) ;
	}
	function toggleUploadInProgress() {
		$('#upload-in-progress').toggle('slow') ;
	}
	function showUploadAlert( reason ) {
		if( reason ) $('#upload-form button[type=submit]').closest('.form-group').append(uploadTemplateFailure({reason: reason})) ;
		else $('#upload-form button[type=submit]').closest('.form-group').append(uploadTemplateSuccess()) ;
		$('#upload-form .alert').show('slow') ;
	}
	function removeUploadAlerts() {
		$('#upload-form .alert').remove() ;		
	}
	function refreshGateways() {
		$.ajax({
			url: '/stratWS/stratGateway'
			,method: 'GET'
			,success: function(data){
				var html = '' ;
				gateways = data.sort(function(a,b) {
					var nameA=a.name.toLowerCase(), nameB=b.name.toLowerCase() ;
					 if (nameA < nameB) return -1 ;
					 if (nameA > nameB) return 1 ;
					 return 0 ;
					}) ;
				var select = $('#gateway') ;
				if( select ) {
					var html = '' ;
					gateways.forEach( function( gw ) { html += '<option>' + gw.name + '</option>'}) ;
					select.find('option[value!="-1"]').remove() ;
					select.append( html) ;
				}
			}
		}) ;
	}
	function validateUploadForm() {
		var ready = true ;

		//turn on or off error styling
		_.each( ['#upload-file','#gateway','#csv','#good','#bad','#sfdc'], function(el) {
			var selector = $('#upload-form').find(el) ;
			var value = selector.val() ;
			$(selector).closest('.form-group').toggleClass('has-error', 0 == value.length ) ;
		}) ;

		//enable or disable the submit button 
		if( $('#upload-form .has-error').length > 0 ) {
			$('#upload-form button[type=submit]').attr('disabled','disabled') ;
			$('#upload-form .has-error').find('select').focus() ;
		}
		else $('#upload-form button[type=submit]').removeAttr('disabled') ;
	}


	//handlers
	$('#upload-form #upload-file').on('change', function(e){ validateUploadForm() ; });
	$('#upload-form #gateway').on('change', function(e){ validateUploadForm() ; });
	$('#upload-form #csv').on('change', function(e){ validateUploadForm() ; });
	$('#upload-form #good').on('change', function(e){ validateUploadForm() ; });
	$('#upload-form #bad').on('change', function(e){ validateUploadForm() ; });
	$('#upload-form #sfdc').on('change', function(e){ validateUploadForm() ; });

	$('#upload-form').on('submit', function(e){ 
		var self = this ;
		e.preventDefault() ;

		$('#upload-form button[type=submit]').attr('disabled','disabled') ;
		removeUploadAlerts() ;

		getStratUploadStatus( function(err, status){
			if( err ) {
				showUploadAlert('An error was experienced attempting your request.  Please retry your request later.') ;
				$('#upload-form button[type=submit]').removeAttr('disabled') ;
			}
			else {
				if( status.inProgress === true ) {
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
							if( data.accepted === true ) {
								showUploadAlert() ;
								$('#upload-form')[0].reset() ;
							}
							else {
								showUploadAlert(data.reason) ;
								$('#upload-form button[type=submit]').removeAttr('disabled') ;
							}
						}
						,error: function(jqXHR, response, errorThrown) {
							console.log('error: ' + JSON.stringify(response)) ;
							$('#upload-form button[type=submit]').removeAttr('disabled') ;
						}
					});
				}
			}
		}) ;

		console.log('submitting form') ; 

		return false ;
	});


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