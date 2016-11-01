/**
prepipitateTime(body, clock_hand )
data_type : minutely / hourly
*/
exports.prepipitateTime = function(dsk_data, clock_hand, prec_status){
    var flag_rain_start, flag_rain_stop = 0;
    var retdata = 0;

    var time2, time_diff_stop, time_diff_start = 0;
    var num_sec = (clock_hand == 'minutely') ? 60 : 3600;

    var curr_prec = dsk_data["currently"]["precipIntensity"];
    var user_time = dsk_data["currently"]["time"];
    var icon = dsk_data[clock_hand]["icon"];
    var data = dsk_data[clock_hand]["data"];

    for(var i=0;i<data.length;i++){
        time2 = data[i]["time"];
        if(time2 > user_time){
            //rain will stop at :
            if(curr_prec > 0 && data[i]["precipIntensity"]==0 && prec_status !='stop')
            {
                time_diff_stop = ((time2-user_time)/num_sec).toFixed(0);
                retdata = 'stop:'+time_diff_stop;
                break;
            }
            //rain will start at :
            if(curr_prec == 0 && data[i]["precipIntensity"]>0 && data[i]["precipProbability"]>0.3 && prec_status !='start')
            {
                time_diff_start = ((time2-user_time)/num_sec).toFixed(0);
                retdata = 'start:'+time_diff_start;
                break;
            }
        }
    }
    return retdata;
}

exports.printMessage = function(prec_status, start_stop_time, icon, hr_min){
    icon = (icon.toString()).charAt(0).toUpperCase() + icon.slice(1);
    if(prec_status == 'start'){
        weather_data = " " + icon + " will probably start in " + start_stop_time + " " + hr_min + ".";
    }
    if(prec_status == 'stop'){
        weather_data = " " + icon + " will probably stop in " + start_stop_time + " " + hr_min + ".";
    }
    return weather_data;
}
