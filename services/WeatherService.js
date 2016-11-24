var self = module.exports = {
    /**
    prepipitateTime(body, clock_hand )
    data_type : minutely / hourly
    */
    precipitateTime : function(dsk_data, clock_hand, prec_status){
        var flag_rain_start, flag_rain_stop = 0;
        var retdata = 0;

        var time2, time_diff_stop, time_diff_start = 0;
        var num_sec = (clock_hand == 'minutely') ? 60 : 3600;
        //var end_time = new Date();
        //end_time = end_time.setHours(23,59,59);
        //end_time = end_time/1000;

        var curr_prec = dsk_data["currently"]["precipIntensity"];
        var user_time = dsk_data["currently"]["time"];
        var icon = dsk_data[clock_hand]["icon"];
        var data = dsk_data[clock_hand]["data"];

        for(var i=0;i<data.length;i++){
            time2 = data[i]["time"];
            //if(time2 > user_time && time2 <= end_time){
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
    },

    printMessage : function(prec_status, start_stop_time, icon, hr_min){
        icon = (icon.toString()).charAt(0).toUpperCase() + icon.slice(1);
        if(prec_status == 'start'){
            weather_data = " " + icon + " will probably start in " + start_stop_time + " " + hr_min + ".";
        }
        if(prec_status == 'stop'){
            weather_data = " " + icon + " will probably stop in " + start_stop_time + " " + hr_min + ".";
        }
        return weather_data;
    },

    prec_forecast : function(body, precipitate_type, begin_end, weather_yesno, channel){
        //Weather forecast per minute
        var min_weather_data = '';
        var yesno_weather_data = '';
        var prec_start, prec_stop = '';
        if(body["minutely"]){
            icon = body["minutely"]["icon"];

            var min_prec_status = 0;
            if(icon == 'snow' || icon == 'rain' || icon == 'drizzle' || icon == 'partly-cloudy-day' || icon == 'partly-cloudy-night'){
                var retdata = self.precipitateTime(body, 'minutely');
                if(retdata){
                    res = retdata.split(':');
                    min_prec_status = res[0];
                    start_stop_time = res[1];
                    min_weather_data = self.printMessage(min_prec_status, start_stop_time, icon, 'min');
                    if(min_prec_status == 'start'){
                        prec_start = min_weather_data;
                    } else{
                        prec_stop = min_weather_data;
                    }
                }
            }
            if(icon.trim() == precipitate_type.trim()){
                min_weather_data1 = "Yes";
            } else {
                min_weather_data1 = "No";
            }
        }
        //Weather forecast per hr
        var hr_weather_data = '';
        if(body["hourly"]){
            icon = body["hourly"]["icon"];
            if(icon == 'snow' || icon == 'rain' || icon == 'drizzle'){
                if(min_prec_status == 'start' || min_prec_status == 0){
                    var retdata = self.precipitateTime(body, 'hourly', min_prec_status);
                    if(retdata){
                        res = retdata.split(':');
                        hr_prec_status = res[0];
                        start_stop_time = res[1];
                        hr_weather_data = self.printMessage(hr_prec_status, start_stop_time, icon, 'hr');
                        if(hr_prec_status == 'start'){
                            prec_start = hr_weather_data;
                        } else{
                            prec_stop = hr_weather_data;
                        }
                    }
                }
            }
            if(icon.trim() == precipitate_type.trim() && min_weather_data1 == "No") {
                hr_weather_data1 = "Yes";
            } else {
                hr_weather_data1 = "No";
            }
        }
        //Handle begin_end queries
        if(begin_end){
            weather_print_data = min_weather_data + hr_weather_data;
        }
        //Handle yes_no queries
        if(weather_yesno){
            prec_yesno = (hr_weather_data1 == "Yes" || min_weather_data1 == "Yes") ? "Yes" : "No";
            weather_print_data = (prec_yesno == 'Yes')?(prec_yesno +', '+ prec_start):(prec_yesno);
        }
        if(channel == 'prec_type'){
            return weather_print_data;
        } else {
            return min_weather_data + hr_weather_data;
        }
    },

    convertTemp : function(temp_f){
        return ((((temp_f-32)*5)/9).toFixed(2))+" \u00B0C";
    }
}
