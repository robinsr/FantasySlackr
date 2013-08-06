var ffl = (function() {
      function ajaxCall(url ,postData, cb){

        $.ajax(url, {
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
        sendLogin: function(){
         var jsonObject = {
          uname: $("#user_name").val(),
          upass: $("#user_pass").val()
         };
         console.log(jsonObject);
         ajaxCall("method/login",jsonObject,function(error,status,responseText){
          if(error != null){
            alert("Error");
          }
        else{
          console.log(status,responseText);
        }

         });
        },
        sendSignup: function(){
          var jsonObject = {
          uname: $("#signup_name").val(),
          upass: $("#signup_pass").val(),
          uemail: $("#signup_email").val()
         };
         ajaxCall("method/createNewUser",jsonObject,function(err,status,responseText){

         })
        }
      }
            
          })();

// event listener 
 
