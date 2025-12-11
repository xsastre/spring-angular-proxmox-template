package cat.daw.template.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

/**
 * Controlador d'exemple per a l'API REST
 */
@RestController
@RequestMapping("/api")
public class HelloController {

    /**
     * Endpoint de benvinguda
     * @return Missatge de benvinguda
     */
    @GetMapping("/hello")
    public Map<String, String> hello() {
        Map<String, String> response = new HashMap<>();
        response.put("message", "Hola des del backend Spring Boot!");
        response.put("version", "1.0.0");
        return response;
    }

    /**
     * Endpoint de verificació de l'estat del servei
     * @return Estat del servei
     */
    @GetMapping("/health")
    public Map<String, Object> health() {
        Map<String, Object> response = new HashMap<>();
        response.put("status", "UP");
        response.put("service", "Template DAW Backend");
        response.put("timestamp", System.currentTimeMillis());
        return response;
    }
}
