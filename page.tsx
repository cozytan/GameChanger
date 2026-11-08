async function handleCreateSession(eventData) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('training_sessions')
    .insert([
      {
        title: eventData.title,
        description: eventData.description,
        session_type: eventData.sessionType,
        expertise_area: eventData.expertiseArea,
        admission_fee: eventData.admissionFee,
        capacity: eventData.capacity,
        scheduled_start: eventData.scheduledStart,
        scheduled_end: eventData.scheduledEnd,
        status: 'UPCOMING'
      }
    ]);

  if (error) console.error('Error creating session:', error);
  else alert('Session created successfully!');
}