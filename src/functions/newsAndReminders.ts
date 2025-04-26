import axios from 'axios';
import { logger } from '../utils/logger.ts';
import dotenv from 'dotenv';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  where,
  deleteDoc,
  Timestamp,
  Query,
  DocumentData,
} from 'firebase/firestore';
import { db } from '../utils/firebase.ts';
import { randomUUID } from 'crypto';

dotenv.config();

// Get latest news
export async function getLatestNews(topic: string, count = 5): Promise<string> {
  try {
    const apiKey = process.env.NEWS_API_KEY;
    if (!apiKey) {
      return JSON.stringify({
        success: false,
        error: 'News API key is missing',
      });
    }

    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(topic)}&sortBy=publishedAt&pageSize=${count}&apiKey=${apiKey}`;

    const response = await axios.get(url);
    const articles = response.data.articles || [];

    const formattedNews = articles.map((article: any) => ({
      title: article.title,
      source: article.source.name,
      url: article.url,
      publishedAt: article.publishedAt,
      description: article.description,
    }));

    return JSON.stringify({
      success: true,
      topic,
      articles: formattedNews,
      count: formattedNews.length,
    });
  } catch (error) {
    logger.error('Error fetching news:', error);
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      topic,
    });
  }
}

// Set a reminder
export async function setReminder(
  title: string,
  description: string,
  dueDate: string,
  dueTime: string,
  priority = 'medium',
): Promise<string> {
  try {
    const id = randomUUID();

    // Parse date and time
    const [year, month, day] = dueDate
      .split('-')
      .map((num) => Number.parseInt(num));
    const [hours, minutes] = dueTime
      .split(':')
      .map((num) => Number.parseInt(num));

    const reminderDate = new Date(year, month - 1, day, hours, minutes);

    const reminder = {
      id,
      title,
      description,
      dueDate: Timestamp.fromDate(reminderDate),
      priority,
      completed: false,
      createdAt: Timestamp.now(),
    };

    await setDoc(doc(db, 'reminders', id), reminder);

    return JSON.stringify({
      success: true,
      reminder: {
        ...reminder,
        dueDate: reminderDate.toISOString(),
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error setting reminder:', error);
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Get reminders
export async function getReminders(includeCompleted = false): Promise<string> {
  try {
    const remindersCollection = collection(db, 'reminders');
    let remindersQuery: Query<DocumentData, DocumentData> = remindersCollection;

    if (!includeCompleted) {
      remindersQuery = query(
        remindersCollection,
        where('completed', '==', false),
      );
    }

    const remindersSnapshot = await getDocs(remindersQuery);

    const remindersList = remindersSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        dueDate: data.dueDate?.toDate().toISOString(),
        createdAt: data.createdAt?.toDate().toISOString(),
      };
    });

    return JSON.stringify({
      success: true,
      reminders: remindersList,
      count: remindersList.length,
    });
  } catch (error) {
    logger.error('Error getting reminders:', error);
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Complete a reminder
export async function completeReminder(id: string): Promise<string> {
  try {
    await setDoc(
      doc(db, 'reminders', id),
      {
        completed: true,
        completedAt: Timestamp.now(),
      },
      { merge: true },
    );

    return JSON.stringify({
      success: true,
      message: 'Reminder marked as completed',
      id,
    });
  } catch (error) {
    logger.error('Error completing reminder:', error);
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Delete a reminder
export async function deleteReminder(id: string): Promise<string> {
  try {
    await deleteDoc(doc(db, 'reminders', id));

    return JSON.stringify({
      success: true,
      message: 'Reminder deleted successfully',
      id,
    });
  } catch (error) {
    logger.error('Error deleting reminder:', error);
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Get weather forecast (extended version of current weather)
export async function getWeatherForecast(
  location: string,
  days = 3,
  unit = 'celsius',
): Promise<string> {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      throw new Error('OpenWeather API key is missing');
    }

    const unitSystem = unit === 'fahrenheit' ? 'imperial' : 'metric';
    const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(location)}&units=${unitSystem}&appid=${apiKey}`;

    const response = await axios.get(url);
    const data = response.data;

    // Group forecast by day
    const forecastByDay: Record<string, any[]> = {};

    data.list.forEach((item: any) => {
      const date = new Date(item.dt * 1000).toISOString().split('T')[0];

      if (!forecastByDay[date]) {
        forecastByDay[date] = [];
      }

      forecastByDay[date].push(item);
    });

    // Get daily summaries (using the middle of the day forecast)
    const dailyForecasts = Object.keys(forecastByDay)
      .slice(0, days)
      .map((date) => {
        const dayData = forecastByDay[date];
        const middayData = dayData[Math.floor(dayData.length / 2)];

        return {
          date,
          temperature: {
            min: Math.round(
              Math.min(...dayData.map((item: any) => item.main.temp_min)),
            ),
            max: Math.round(
              Math.max(...dayData.map((item: any) => item.main.temp_max)),
            ),
            unit: unit === 'fahrenheit' ? '°F' : '°C',
          },
          conditions: middayData.weather[0]?.main || 'Unknown',
          description: middayData.weather[0]?.description || 'Unknown',
          humidity: `${middayData.main.humidity}%`,
          wind: `${Math.round(middayData.wind.speed)} ${unitSystem === 'imperial' ? 'mph' : 'm/s'}`,
          precipitation: middayData.pop
            ? `${Math.round(middayData.pop * 100)}%`
            : '0%',
        };
      });

    return JSON.stringify({
      success: true,
      location: data.city.name + ', ' + data.city.country,
      forecast: dailyForecasts,
      days: dailyForecasts.length,
    });
  } catch (error) {
    let errorMessage = 'Failed to retrieve weather forecast';

    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        errorMessage = `Location "${location}" not found`;
      } else if (error.response?.status === 401) {
        errorMessage = 'Invalid API key';
      }
      logger.error(
        `Weather API error (${error.response?.status}):`,
        error.message,
      );
    } else {
      logger.error('Error fetching weather forecast:', error);
    }

    return JSON.stringify({
      success: false,
      error: errorMessage,
      location,
    });
  }
}
