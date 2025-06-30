// Calendar Integration for EchoCare
// Connects to various calendar services

export interface CalendarEvent {
  id: string
  title: string
  description?: string
  start: Date
  end?: Date
  location?: string
  type: 'medication' | 'appointment' | 'social' | 'general'
  reminderMinutes: number
  isRecurring: boolean
  source: 'google' | 'outlook' | 'apple' | 'manual'
}

export interface CalendarIntegration {
  google: boolean
  outlook: boolean
  apple: boolean
}

// Get calendar integration status
export function getCalendarIntegrationStatus(): CalendarIntegration {
  return {
    google: localStorage.getItem('google_calendar_connected') === 'true',
    outlook: localStorage.getItem('outlook_calendar_connected') === 'true',
    apple: localStorage.getItem('apple_calendar_connected') === 'true'
  }
}

// Connect to Google Calendar
export async function connectGoogleCalendar(): Promise<boolean> {
  try {
    console.log('📅 Attempting to connect to Google Calendar...')
    
    // In a real app, this would use Google Calendar API with OAuth
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    const connected = Math.random() > 0.2 // 80% success rate for demo
    
    if (connected) {
      console.log('✅ Google Calendar connected successfully')
      localStorage.setItem('google_calendar_connected', 'true')
      return true
    } else {
      console.log('❌ Google Calendar connection failed')
      return false
    }
  } catch (error) {
    console.error('Google Calendar connection error:', error)
    return false
  }
}

// Connect to Outlook Calendar
export async function connectOutlookCalendar(): Promise<boolean> {
  try {
    console.log('📅 Attempting to connect to Outlook Calendar...')
    
    await new Promise(resolve => setTimeout(resolve, 1800))
    
    const connected = Math.random() > 0.25 // 75% success rate for demo
    
    if (connected) {
      console.log('✅ Outlook Calendar connected successfully')
      localStorage.setItem('outlook_calendar_connected', 'true')
      return true
    } else {
      console.log('❌ Outlook Calendar connection failed')
      return false
    }
  } catch (error) {
    console.error('Outlook Calendar connection error:', error)
    return false
  }
}

// Connect to Apple Calendar
export async function connectAppleCalendar(): Promise<boolean> {
  try {
    console.log('📅 Attempting to connect to Apple Calendar...')
    
    await new Promise(resolve => setTimeout(resolve, 2200))
    
    const connected = Math.random() > 0.3 // 70% success rate for demo
    
    if (connected) {
      console.log('✅ Apple Calendar connected successfully')
      localStorage.setItem('apple_calendar_connected', 'true')
      return true
    } else {
      console.log('❌ Apple Calendar connection failed')
      return false
    }
  } catch (error) {
    console.error('Apple Calendar connection error:', error)
    return false
  }
}

// Disconnect calendar
export function disconnectCalendar(source: string): void {
  localStorage.removeItem(`${source}_calendar_connected`)
  console.log(`🔌 Disconnected from ${source} Calendar`)
}

// Generate sample calendar events
export function generateSampleEvents(): CalendarEvent[] {
  const now = new Date()
  const events: CalendarEvent[] = []

  // Generate events for the next 30 days
  for (let i = 0; i < 30; i++) {
    const date = new Date(now)
    date.setDate(date.getDate() + i)

    // Morning medication
    if (i % 1 === 0) { // Daily
      const medicationTime = new Date(date)
      medicationTime.setHours(8, 0, 0, 0)
      events.push({
        id: `med-morning-${i}`,
        title: 'Morning Medication',
        description: 'Take blood pressure medication',
        start: medicationTime,
        end: new Date(medicationTime.getTime() + 15 * 60 * 1000),
        type: 'medication',
        reminderMinutes: 15,
        isRecurring: true,
        source: 'manual'
      })
    }

    // Evening medication
    if (i % 1 === 0) { // Daily
      const medicationTime = new Date(date)
      medicationTime.setHours(20, 0, 0, 0)
      events.push({
        id: `med-evening-${i}`,
        title: 'Evening Medication',
        description: 'Take vitamins and supplements',
        start: medicationTime,
        end: new Date(medicationTime.getTime() + 15 * 60 * 1000),
        type: 'medication',
        reminderMinutes: 15,
        isRecurring: true,
        source: 'manual'
      })
    }

    // Doctor appointments (weekly)
    if (i % 7 === 3) {
      const appointmentTime = new Date(date)
      appointmentTime.setHours(10, 30, 0, 0)
      events.push({
        id: `appointment-${i}`,
        title: 'Doctor Appointment',
        description: 'Regular checkup with Dr. Johnson',
        start: appointmentTime,
        end: new Date(appointmentTime.getTime() + 60 * 60 * 1000),
        location: 'Medical Center, 123 Health St',
        type: 'appointment',
        reminderMinutes: 60,
        isRecurring: false,
        source: 'google'
      })
    }

    // Family calls (twice a week)
    if (i % 3 === 1) {
      const callTime = new Date(date)
      callTime.setHours(15, 0, 0, 0)
      events.push({
        id: `family-call-${i}`,
        title: 'Family Video Call',
        description: 'Weekly call with Sarah and the grandkids',
        start: callTime,
        end: new Date(callTime.getTime() + 45 * 60 * 1000),
        type: 'social',
        reminderMinutes: 30,
        isRecurring: false,
        source: 'outlook'
      })
    }

    // Exercise (3 times a week)
    if (i % 2 === 0) {
      const exerciseTime = new Date(date)
      exerciseTime.setHours(9, 0, 0, 0)
      events.push({
        id: `exercise-${i}`,
        title: 'Morning Walk',
        description: '30-minute walk in the park',
        start: exerciseTime,
        end: new Date(exerciseTime.getTime() + 30 * 60 * 1000),
        location: 'Central Park',
        type: 'general',
        reminderMinutes: 15,
        isRecurring: true,
        source: 'apple'
      })
    }
  }

  return events.sort((a, b) => a.start.getTime() - b.start.getTime())
}

// Get upcoming events
export function getUpcomingEvents(events: CalendarEvent[], days: number = 7): CalendarEvent[] {
  const now = new Date()
  const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
  
  return events.filter(event => 
    event.start >= now && event.start <= futureDate
  ).slice(0, 10) // Limit to 10 events
}

// Get today's events
export function getTodaysEvents(events: CalendarEvent[]): CalendarEvent[] {
  const today = new Date()
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)
  
  return events.filter(event => 
    event.start >= startOfDay && event.start < endOfDay
  )
}

// Save calendar events to database
export async function saveCalendarEvents(events: CalendarEvent[], userId: string): Promise<boolean> {
  try {
    const { supabase } = await import('./supabase')
    
    const calendarRecords = events.map(event => ({
      user_id: userId,
      external_id: event.id,
      title: event.title,
      description: event.description,
      event_type: event.type,
      start_time: event.start.toISOString(),
      end_time: event.end?.toISOString(),
      location: event.location,
      reminder_minutes: event.reminderMinutes,
      is_recurring: event.isRecurring,
      source: event.source
    }))
    
    const { error } = await supabase
      .from('calendar_events')
      .upsert(calendarRecords, { onConflict: 'external_id' })
    
    if (error) {
      console.error('Error saving calendar events:', error)
      return false
    }
    
    console.log('✅ Calendar events saved successfully')
    return true
  } catch (error) {
    console.error('Error saving calendar events:', error)
    return false
  }
}

// Get calendar events from database
export async function getCalendarEventsFromDB(userId: string): Promise<CalendarEvent[]> {
  try {
    const { supabase } = await import('./supabase')
    
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', userId)
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .limit(50)
    
    if (error) {
      console.error('Error fetching calendar events:', error)
      return []
    }
    
    return (data || []).map(event => ({
      id: event.external_id || event.id,
      title: event.title,
      description: event.description,
      start: new Date(event.start_time),
      end: event.end_time ? new Date(event.end_time) : undefined,
      location: event.location,
      type: event.event_type as any,
      reminderMinutes: event.reminder_minutes,
      isRecurring: event.is_recurring,
      source: event.source as any
    }))
  } catch (error) {
    console.error('Error fetching calendar events:', error)
    return []
  }
}