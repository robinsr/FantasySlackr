$('.dropdown-menu').click(function(event){
            if($(this).hasClass('keep_open')){
             event.stopPropagation();
            }
        });