const supabase = require('./supabase');

async function saveJobCard({ vehicle_registration, job_date, description, fuel, price, time_out, time_in, driver_job_id, reporter_jid, message_id }) {
    try {
        const { data, error } = await supabase
            .from('job_cards')
            .insert([{
                vehicle_registration,
                job_date,
                description,
                fuel,
                price,
                time_out,
                time_in,
                driver_job_id,
                reporter_jid,
                message_id
            }])
            .select('id')
            .single();

        if (error) {
            console.error('Error saving job card:', error);
            throw error;
        }
        return data.id;
    } catch (err) {
        console.error('Error in saveJobCard:', err);
        throw err;
    }
}

async function deleteJobCardByMessageId(messageId) {
    try {
        const { data, error } = await supabase
            .from('job_cards')
            .delete()
            .eq('message_id', messageId)
            .select('*')
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null; // No rows deleted
            }
            throw error;
        }
        return data;
    } catch (err) {
        console.error('Error in deleteJobCardByMessageId:', err);
        throw err;
    }
}

module.exports = {
    saveJobCard,
    deleteJobCardByMessageId
};
