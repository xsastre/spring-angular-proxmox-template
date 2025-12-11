import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * Servei per consumir l'API del backend
 */
@Injectable({
  providedIn: 'root'
})
export class ApiService {

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  /**
   * Obté el missatge de benvinguda del backend
   */
  getHello(): Observable<any> {
    return this.http.get(`${this.apiUrl}/hello`);
  }

  /**
   * Comprova l'estat del servei backend
   */
  getHealth(): Observable<any> {
    return this.http.get(`${this.apiUrl}/health`);
  }
}
