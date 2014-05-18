module.exports = function(e){
    return e.define('stat_category',{
        stat_id : null,
        enabled : null,
        name : null,
        display_name : null,
        sort_order : null,
        position_type : null,
        stat_position_types : {
            stat_position_type : {
                position_type : null
            }
        }
    },{},{});
};