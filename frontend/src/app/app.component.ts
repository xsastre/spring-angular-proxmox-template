import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from './services/api.service';

/**
 * Component principal de l'aplicació
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'Template DAW - Spring Boot + Angular';
  backendMessage = '';
  backendStatus = '';
  loading = true;
  error = '';

  constructor(private apiService: ApiService) {}

  ngOnInit() {
    this.loadData();
  }

  /**
   * Carrega les dades del backend
   */
  loadData() {
    this.loading = true;
    this.error = '';

    // Obtenir missatge de benvinguda
    this.apiService.getHello().subscribe({
      next: (data) => {
        this.backendMessage = data.message;
      },
      error: (err) => {
        this.error = 'Error connectant amb el backend';
        console.error('Error:', err);
      }
    });

    // Obtenir estat del servei
    this.apiService.getHealth().subscribe({
      next: (data) => {
        this.backendStatus = data.status;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Error connectant amb el backend';
        this.loading = false;
        console.error('Error:', err);
      }
    });
  }

  /**
   * Recarrega les dades del backend
   */
  reload() {
    this.loadData();
  }
}
