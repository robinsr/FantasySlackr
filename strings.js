

var fantasyFlackrUtils = (function() {
      function ajaxCall(postData, cb){


        $.ajax({
              url: "method/login",
              type: 'POST',
              dataType: "json",
              processData: false,
        contentType: 'application/json',
              data: JSON.stringify(postData),
              error: function(){
                cb(true);
                return
              },
              complete: function(dat){
                cb(null,dat.status,dat.responseText);
                return
              }
            }); 

      }

      return{
        publicAjaxCall: function(){
      
         var jsonObject = {
          uname: $("#uname").value,
          pass: $("#pass").value
         };
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
$("#signin_form").submit(function(){
  fantasyFlackrUtils.publicAjaxCall()

})