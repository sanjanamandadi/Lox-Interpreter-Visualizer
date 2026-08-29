# Use an official OpenJDK runtime as the base image
FROM eclipse-temurin:17-jdk-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy all source files into the container
COPY . .

# Create the bin directory and compile all Java files
RUN mkdir -p bin && javac -encoding UTF-8 -d bin $(find src -name "*.java")

# Expose port 8080 for the HTTP server
EXPOSE 8080

# Run the Java server
CMD ["java", "-cp", "bin", "com.craftinginterpreters.lox.TraceServer"]