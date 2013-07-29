

var fantasyFlackrUtils = (function() {
      function ajaxCall(postData, cb){

        $.ajax("method/login", {
          data : JSON.stringify(postData),
          contentType : 'application/json',
          type : 'POST',
          success: function(dat){
            console.log(dat)
          },
          error: function(dat){
            console.log(dat)
          }
        });


      }

      return{
        publicAjaxCall: function(){
      
         var jsonObject = {
          uname: $("#user_name").val(),
          pass: $("#user_pass").val()
         };
         console.log(jsonObject);
         ajaxCall(jsonObject,function(error,status,responseText){
          if(error != null){
            alert("Error");
          }
        else{
          console.log(status,responseText);
        }

         });
        }
      }
            
          })();

// event listener 
 


$(document).ready(function(){
  $("#signin_form").submit(function(){
    event.preventDefault();
    fantasyFlackrUtils.publicAjaxCall()
  })
})
