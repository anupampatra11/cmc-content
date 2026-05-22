package com.contentvelocity;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class ContentVelocityApplication {
    public static void main(String[] args) {
        SpringApplication.run(ContentVelocityApplication.class, args);
    }
}
