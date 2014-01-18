ko.observable.fn.subscribeAjaxIcons = function(type,cb){
    this.subscribe(function(value){
        cb('loading')
        var obj = {
            type: type,
            value: value
        }
        console.log('sending issue')
        utils.issue("POST", "method/checkValue",obj,function(err,stat,text){
            if (stat == 200){
                cb('verified');
            } else if (stat == 400) {
                cb('rejected');
            } else {
                cb('');
            }
        })
    });
}
ko.observable.fn.subscribeCheckPass = function(cb){
    this.subscribe(function(value){
        if (value.length > 8) {
            cb('verified');
        } else {
            cb ('rejected');
        }
    })
}
ko.bindingHandlers.modalVis = {
	init: function(element, valueAccessor) {
        var value = valueAccessor();
    },
    update: function(element, valueAccessor) {
        var value = valueAccessor();
        var showon = $(element).data("showon")
        if (value() == showon){
        	$(element).modal('show');
        } else {
        	$(element).modal('hide')
        }
    }
};
ko.bindingHandlers.formShake = {
    init: function(element, valueAccessor) {
        var value = valueAccessor();
    },
    update: function(element, valueAccessor) {
        var value = valueAccessor();
        var showon = $(element).data("shakeon")
        if (value() == showon){
            $(element).shake()
        } 
    }
};
ko.bindingHandlers.ajaxIcons = {
    init: function(element, valueAccessor) {
        var value = valueAccessor();
    },
    update: function(element, valueAccessor) {
        var value = valueAccessor();
        $(element).removeClass('loading').removeClass('verified').removeClass('rejected');
        if (value() != '') {
            $(element).addClass(value());
        }
    }
};
ko.bindingHandlers.changeSetting = {
    init: function(element, valueAccessor){
        var value = valueAccessor()
        $(element).change(function(){
            value(this.value);
        })
    },
    update: function(element, valueAccessor){
        var value = valueAccessor()
        $(element).val(value());
    }
}
ko.bindingHandlers.accordianClick = {
    init: function(element, valueAccessor){
        var value = valueAccessor();
        $(element).click(function(){
            var select = "#" + value;
            console.log(value);
            $(select).collapse();
            console.log($(select))
        })
    },
    update: function(element, valueAccessor){
        var value = valueAccessor()
        $(element).val(value());
    }
}
ko.bindingHandlers.startOrBench = {
    init: function(element, valueAccessor,ab,vm,bc){
        var value = valueAccessor();
        $(element).click(function(){
            var player = vm;
            var positions = bc.$root.positions();
            var button = $(this).text();

                // Only move player to start if there is an open spot for that position.
                // Can always move player to bench
            $(positions).each(function(obj,ind){
                if (this.team_key == vm.team_key && this.position == vm.position){
                    if (button == 'Start'){
                        if (this.starters() >= parseInt(this.count)){
                            $(element).addClass("btn-danger");
                            setTimeout(function(){
                                $(element).removeClass("btn-danger");
                            },500)
                        } else {
                            value.selected_position(value.position)
                        }
                    } else {
                        value.selected_position("BN");
                    }
                }
            })
        })
    },
    update: function(element, valueAccessor){
        console.log()
        var value = valueAccessor();
        if ((value.selected_position() == "BN") && ($(element).text() == "Bench")){
            $(element).addClass("btn-primary");
        } else if ((value.selected_position() != "BN") && ($(element).text() != "Bench")){
            $(element).addClass("btn-primary");
        } else {
            $(element).removeClass("btn-primary");
        }
    }
}
ko.bindingHandlers.positionCountIndicator = {
    init: function(element, valueAccessor){},
    update: function(element, valueAccessor){
        var value = valueAccessor()
        if (value.starters() > parseInt(value.count)){
            $(element).addClass('position-danger').removeClass('position-success');
        } else if (value.starters() == parseInt(value.count)){
            $(element).addClass('position-success').removeClass('position-danger');
        } else {
            $(element).removeClass('position-danger').removeClass('position-success');
        }
    }
}
ko.bindingHandlers.checkSelPlayer = {
    init: function(element){},
    update: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext){
        var value = valueAccessor();
        if (bindingContext.$data.player_key == value()){
            console.log('checking '+bindingContext.$data.player_full_name)
            $(element).addClass("btn-primary").removeClass("btn-default")
        } else {
            $(element).addClass("btn-default").removeClass("btn-primary")
        }
    }
}
ko.bindingHandlers.formatDate = {
    update: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext){
        var value = valueAccessor();
        var d = new Date(value);
        var months = ['January','February','March','April','May','June','July','Auguest','September','October','November','December'];

        function daySuffix(d) {
            d = String(d);
            return d.substr(-(Math.min(d.length, 2))) > 3 && d.substr(-(Math.min(d.length, 2))) > 21 ? "th" : ["th", "st", "nd", "rd", "th"][Math.min(Number(d)%10, 4)];
        }

        var dateString = months[d.getMonth()] + " " + d.getDate()  + daySuffix(d.getDate()) + ", " + d.getFullYear();

        $(element).text(dateString);
    }
}
ko.bindingHandlers.collapse = {
    update: function(element,valueAccessor){
        var val = valueAccessor();
        console.log(val)
        if (val){
            $(element).collapse('show')
        } else {
            $(element).collapse('hide');
        }
    }
}
ko.bindingHandlers.switchPanel = {
    init:function(element,valueAccessor,ab,vm,bc){
        $(element).click(function(){
            var val = valueAccessor();
            vm.showPanel(val);
        })
        
    }
}