
pipeline {
    agent any

    environment {
        IMAGE_NAME = 'shopping-cart'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Check Tools') {
            steps {
                bat 'node --version'
                bat 'npm --version'
                bat 'docker --version'
            }
        }

        stage('Install Dependencies') {
            steps {
                bat 'npm ci'
            }
        }

        stage('Build Docker Image') {
            steps {
                bat "docker build -t ${IMAGE_NAME}:${BUILD_NUMBER} -t ${IMAGE_NAME}:latest ."
            }
        }
    }

    post {
        success {
            echo "Built ${IMAGE_NAME}:${BUILD_NUMBER}"
        }
        failure {
            echo 'Build failed.'
        }
    }
}
