import { WeatherResponse } from '../../types/index.ts';
import { logger } from '../../utils/logger.ts';
import dotenv from "dotenv";
import axios from 'axios';

dotenv.config();


// Using OpenWeatherMap API (free tier)
export async function getWeatherData(
    location: string,
    unit: string = 'celsius',
  ): Promise<string> {
    try {
      // OpenWeatherMap API endpoint
      const apiKey = process.env.OPENWEATHER_API_KEY; // Add this to your .env file
      if (!apiKey) {
        throw new Error('OpenWeather API key is missing');
      }
  
      const unitSystem = unit === 'fahrenheit' ? 'imperial' : 'metric';
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&units=${unitSystem}&appid=${apiKey}`;
      
      const response = await axios.get(url);
      const data = response.data;
  
      // Format the response to match your existing structure
      const weatherData: WeatherResponse = {
        location: data.name + ', ' + (data.sys?.country || ''),
        temperature: {
          value: Math.round(data.main.temp),
          unit: unit === 'fahrenheit' ? '°F' : '°C',
        },
        conditions: data.weather[0]?.main || 'Unknown',
        humidity: `${data.main.humidity}%`,
        wind: `${Math.round(data.wind.speed)} ${unitSystem === 'imperial' ? 'mph' : 'm/s'}`,
        last_updated: new Date().toISOString(),
      };
  
      return JSON.stringify(weatherData);
    } catch (error) {
      let errorMessage = 'Failed to retrieve weather data';
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          errorMessage = `Location "${location}" not found`;
        } else if (error.response?.status === 401) {
          errorMessage = 'Invalid API key';
        }
        logger.error(`Weather API error (${error.response?.status}):`, error.message);
      } else {
        logger.error('Error fetching weather data:', error);
      }
      
      return JSON.stringify({ 
        error: errorMessage,
        location,
        last_updated: new Date().toISOString()
      });
    }
  }