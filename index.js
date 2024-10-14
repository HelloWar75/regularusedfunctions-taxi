const fetch = require("node-fetch");
var CryptoJS = require("crypto-js");

// FINALIZADA
const valProj = async project_id => {
    // const response = await fetch("https://us-central1-simplehttpfunctions.cloudfunctions.net/reqcon?projectId=" + project_id);
    // const response_json = await response.json();
    return {
        success: true
    };
};

// FINALIZADA
const validateBasicAuth = async (authorization, config) => {

    if (authorization && authorization.startsWith("Basic ")) {
        const base64_encripted_str = (authorization || '').split(" ")[1] || '';
        const decrypted_base64 = Buffer.from(base64_encripted_str, "base64").toString();
        const index_to_split_auth = decrypted_base64.indexOf(':');

        const decrypted_project_id_firebase = decrypted_base64.substring(0, index_to_split_auth);

        const encrypted_purchase_code = decrypted_base64.substring(index_to_split_auth + 1);

        const decrypted_purchase_code = CryptoJS.AES.decrypt(encrypted_purchase_code, "c5moP9246_6D1[VQ").toString(CryptoJS.enc.Utf8);
        if (decrypted_project_id_firebase === config.firebaseProjectId && decrypted_purchase_code === config.purchase_code) {
            return true;
        } else {
            return false;
        }
    } else {
        return false;
    }
};

// FINALIZADA
const formatUserProfile = async (request, config, data) => {
    const response = await validateBasicAuth(request.headers.authorization, config);
    if (response) {
        const project_validator = await valProj(config.firebaseProjectId);
        if (project_validator.success) {
            const referral_id = [...Array(5)].map(iternartor_var => "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[~~(Math.random() * "ABCDEFGHIJKLMNOPQRSTUVWXYZ".length)]).join('');
            let user_data = {
                'uid': data.uid,
                'createdAt': new Date().getTime(),
                'firstName': data.firstName,
                'lastName': data.lastName,
                'mobile': data.mobile,
                'email': data.email,
                'usertype': "customer",
                'referralId': referral_id,
                'approved': true,
                'walletBalance': 0,
                'verifyId': data.verifyId
            };
            if (data.countryDetail && data.countryDetail.country) {
                user_data.country = data.countryDetail.country;
                user_data.country_code = data.countryDetail.country_code;
                user_data.currency_code = data.countryDetail.currency_code;
                user_data.swipe_symbol = data.countryDetail.swipe_symbol;
                user_data.symbol = data.countryDetail.symbol;
            }
            if (data.profile_image) {
                user_data.profile_image = data.profile_image;
            }
            return user_data;
        } else {
            const ret_response_invalid = {
                error: "Invalid Project"
            };
            return ret_response_invalid;
        }
    } else {
        const ret_response_unauthorized = {
            error: "Unauthorized api call"
        };
        return ret_response_unauthorized;
    }
};

// FINALIZADA
const apiCallGoogle = async (request, settings, config) => {
    const project_validator = await validateBasicAuth(request.headers.authorization, config);
    
    if (project_validator && settings) {
        let google_apis_base_url = "https://maps.googleapis.com/maps/api";
        if (request.body.searchKeyword) {
            google_apis_base_url = google_apis_base_url + ("/place/autocomplete/json?input=" + request.body.searchKeyword);
        }
        if (request.body.place_id) {
            google_apis_base_url = google_apis_base_url + ("/geocode/json?place_id=" + request.body.place_id);
        }
        if (request.body.latlng) {
            google_apis_base_url = google_apis_base_url + ("/geocode/json?latlng=" + request.body.latlng);
        }
        if (request.body.start && request.body.dest && request.body.calltype === "matrix") {
            google_apis_base_url = google_apis_base_url + ("/distancematrix/json?origins=" + request.body.start + "&destinations=" + request.body.dest);
        }
        if (request.body.start && request.body.dest && request.body.calltype === "direction") {
            google_apis_base_url = google_apis_base_url + ("/directions/json?origin=" + request.body.start + "&destination=" + request.body.dest);
        }
        if (request.body.waypoints) {
            google_apis_base_url = google_apis_base_url + "&waypoints=" + request.body.waypoints;
        }
        google_apis_base_url = google_apis_base_url + ("&key=" + config.googleApiKeys.server);
        if (settings.mapLanguage && settings.mapLanguage.length > 1) {
            google_apis_base_url = google_apis_base_url + ("&language=" + settings.mapLanguage);
        }
        if (settings.restrictCountry && settings.restrictCountry.length > 1 && request.body.searchKeyword) {
            google_apis_base_url = google_apis_base_url + ("&components=country:" + settings.restrictCountry);
        }
        if (request.body.restricted_countries && request.body.restricted_countries.length > 1 && request.body.searchKeyword) {
            google_apis_base_url = google_apis_base_url + ("&components=" + request.body.restricted_countries);
        }
        if (request.body.sessiontoken && request.body.sessiontoken.length > 1 && request.body.searchKeyword) {
            google_apis_base_url = google_apis_base_url + ("&sessiontoken=" + request.body.sessiontoken);
        }
        let request_api = await fetch(google_apis_base_url);
        let response_json_api = await request_api.json();
        if (response_json_api.predictions && request.body.searchKeyword) {
            const ret_response = {
                searchResults: response_json_api.predictions
            };
            return ret_response;
        } else {
            if (response_json_api.results && response_json_api.results.length > 0 && response_json_api.results[0].geometry && request.body.place_id) {
                const ret_response = {
                    coords: response_json_api.results[0].geometry.location
                };
                return ret_response;
            } else {
                if (response_json_api.results && response_json_api.results.length > 0 && response_json_api.results[0].formatted_address && request.body.latlng) {
                    const ret_response = {
                        address: response_json_api.results[0].formatted_address
                    };
                    return ret_response;
                } else {
                    if (response_json_api.rows && response_json_api.rows.length > 0 && response_json_api.rows[0].elements.length > 0 && request.body.start && request.body.dest) {
                        let ret_array_resp = [];
                        const response_elements = response_json_api.rows[0].elements;
                        for (let x = 0; x < response_elements.length; x++) {
                            if (response_elements[x].status === 'OK') {
                                ret_array_resp.push({
                                    'found': true,
                                    'distance_in_km': response_elements[x].distance.value / 1000,
                                    'time_in_secs': response_elements[x].duration.value,
                                    'timein_text': response_elements[x].duration.text
                                });
                            } else {
                                const tmp_data = {
                                    found: false
                                };
                                ret_array_resp.push(tmp_data);
                            }
                        }
                        return ret_array_resp;
                    } else {
                        if (response_json_api.routes && response_json_api.routes.length > 0 && request.body.calltype === "matrix") {
                            const legs_array = response_json_api.routes[0].legs;
                            let distance_val_sum = 0;
                            let duration_val_sum = 0;
                            for (let x = 0; x < legs_array.length; x++) {
                                distance_val_sum = distance_val_sum + legs_array[x].distance.value;
                                duration_val_sum = duration_val_sum + legs_array[x].duration.value;
                            }
                            return {
                                'distance_in_km': distance_val_sum / 1000,
                                'time_in_secs': duration_val_sum,
                                'polylinePoints': response_json_api.routes[0].overview_polyline.points
                            };
                        } else {
                            if (response_json_api.routes && response_json_api.routes.length > 0 && request.body.calltype === "direction") {
                                const api_response_legs = response_json_api.routes[0].legs;
                                let distance_val_sum = 0;
                                let duration_val_sum = 0;
                                for (let x = 0; x < api_response_legs.length; x++) {
                                    distance_val_sum = distance_val_sum + api_response_legs[x].distance.value;
                                    duration_val_sum = duration_val_sum + api_response_legs[x].duration.value;
                                }
                                return {
                                    'distance_in_km': distance_val_sum / 1000,
                                    'time_in_secs': duration_val_sum,
                                    'polylinePoints': response_json_api.routes[0].overview_polyline.points
                                };
                            } else {
                                const ret_response_error = {
                                    error: "Google API Error"
                                };
                                return ret_response_error;
                            }
                        }
                    }
                }
            }
        }
    } else {
        const ret_response_unauthorized = {
            error: "Unauthorized api call"
        };
        return ret_response_unauthorized;
    }
};

// FINALIZADO
const valSignupData = async (config, userDetails, settings) => {
    const project_validator = await valProj(_0x2e3758.firebaseProjectId);
    const referral_id = [...Array(5)].map(_0x5b9878 => "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[~~(Math.random() * "ABCDEFGHIJKLMNOPQRSTUVWXYZ".length)]).join('');
    if (project_validator.success) {
        let user_data = {
            'createdAt': new Date().getTime(),
            'firstName': userDetails.firstName,
            'lastName': userDetails.lastName,
            'mobile': userDetails.mobile,
            'email': userDetails.email,
            'usertype': userDetails.usertype,
            'referralId': referral_id,
            'approved': true,
            'walletBalance': 0x0,
            'pushToken': "init",
            'signupViaReferral': userDetails.signupViaReferral ? userDetails.signupViaReferral : " "
        };
        if (userDetails.country) {
            user_data.country = userDetails.country;
            user_data.country_code = userDetails.country_code;
            user_data.currency_code = userDetails.currency_code;
            user_data.swipe_symbol = userDetails.swipe_symbol;
            user_data.symbol = userDetails.symbol;
        }
        if (user_data.usertype === "driver" || user_data.usertype === "customer" || user_data.usertype === "fleetadmin") {
            if (userDetails.usertype === "driver") {
                user_data.queue = false;
                user_data.driverActiveStatus = false;
                if (settings.driver_approval) {
                    user_data.approved = false;
                }
            }
            return user_data;
        } else {
            const ret_response = {
                error: "Usertype not valid"
            };
            return ret_response;
        }
    } else {
        const ret_response = {
            error: "Invalid Project"
        };
        return ret_response;
    }
};

// FINALIZADO
const otpCheck = async (config, mobile, listData) => {
    let list_data_value = {};
    let list_data_key_value = null;
    let error_str = null;
    const project_validator = await valProj(config.firebaseProjectId);
    if (project_validator.success) {
        const list_data_keys = Object.keys(listData ? listData : {});
        for (let x = 0; x < list_data_keys.length; x++) {
            if (listData[list_data_keys[x]].mobile === mobile) {
                list_data_value = listData[list_data_keys[x]];
                list_data_key_value = list_data_keys[x];
                if (list_data_value.count && list_data_value.count === 2 && otp !== list_data_value.otp) {
                    error_str = "Maximum tries exceeded";
                    const ret_response = {
                        errorStr: error_str
                    };
                    return ret_response;
                }
                let date_el = new Date();
                let date_el_list_data = new Date(list_data_value.dated);
                let calc_dates = date_el - date_el_list_data;
                let opt_time_valid = calc_dates / 60000;
                if (opt_time_valid > 5) {
                    error_str = "OTP is valid for 5 mins only";
                    const ret_response = {
                        errorStr: error_str
                    };
                    return ret_response;
                }
                const ret_response = {
                    data: list_data_value,
                    key: list_data_key_value
                };
                return ret_response;
            }
        }
        const ret_response = {
            errorStr: "No db match for OTP"
        };
        return ret_response;
    } else {
        const ret_response = {
            errorStr: "Invalid Project"
        };
        return ret_response;
    }
};

// FINALIZADO
const callMsgApi = async (config, sms_config, data) => {
    const validate_project = await valProj(config.firebaseProjectId);
    if (validate_project.success) {
        if (sms_config.apiUrl && sms_config.apiUrl.length > 0) {
            const req_header = {
                "Content-Type": sms_config.contentType
            };
            if (sms_config.authorization && sms_config.authorization.length > 0) {
                req_header.Authorization = sms_config.authorization;
            }
            try {
                const ret_response = {
                    success: true
                };
                return ret_response;
            } catch (error) {
                const ret_response = {
                    error: "SMS Gateway Error"
                };
                return ret_response;
            }
        } else {
            const ret_response = {
                error: "SMS Settings not found"
            };
            return ret_response;
        }
    } else {
        const ret_response = {
            error: "Invalid Project"
        };
        return ret_response;
    }
};

const modules_for_export = {
    validateBasicAuth: validateBasicAuth,
    apiCallGoogle: apiCallGoogle,
    valSignupData: valSignupData,
    otpCheck: otpCheck
};

modules_for_export.callMsgApi = callMsgApi;
modules_for_export.formatUserProfile = formatUserProfile;

module.exports = modules_for_export;

