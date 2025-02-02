// Remove all previous map code and replace with this:
document.addEventListener('DOMContentLoaded', function() {
    const mapContainer = document.getElementById('map');
    
    // Use the provided SVG map
    fetch('world (1).svg')
        .then(response => response.text())
        .then(svgContent => {
            mapContainer.innerHTML = svgContent;
            
            const svg = mapContainer.querySelector('svg');
            svg.setAttribute('width', '100%');
            svg.setAttribute('height', '100%');
            svg.style.backgroundColor = '#ffffff';
            
            // Define our service countries with their paths using country codes
            const serviceCountries = {
                'ES': { url: 'https://cuponhub.es' },      // Spain
                'PT': { url: 'https://cupaohub.pt' },      // Portugal
                'MX': { url: 'https://cuponhub.com.mx' },  // Mexico
                'CO': { url: 'https://cuponhub.com.co' },  // Colombia
                'AR-2': { url: 'https://cuponhub.com.ar' }   // Argentina
            };

            // Add styles to the SVG
            const style = document.createElement('style');
            style.textContent = `
                svg {
                    stroke-width: 0.2;
                }
                path {
                    fill: #f0f0f0;
                    stroke: #ffffff;
                    transition: fill 0.3s ease;
                }
                path[id="ES"],
                path[id="PT"],
                path[id="MX"],
                path[id="CO"],
                path[id="AR-2"] {   
                    fill: #37447E !important;
                    cursor: pointer;
                }
                path[id="ES"]:hover,
                path[id="PT"]:hover,
                path[id="MX"]:hover,
                path[id="CO"]:hover,
                path[id="AR-2"]:hover {
                    fill: #4B61DC !important;
                }
            `;
            document.head.appendChild(style);

            // Add click handlers for service countries
            const addClickHandler = (element, url) => {
                if (element) {
                    element.addEventListener('click', () => {
                        window.open(url, '_blank');
                    });
                }
            };

            // Add click handlers for each country using ID selectors
            Object.entries(serviceCountries).forEach(([countryCode, data]) => {
                const countryPath = svg.querySelector(`path[id="${countryCode}"]`);
                addClickHandler(countryPath, data.url);
            });

            // Remove any default fill colors that might interfere
            svg.querySelectorAll('path').forEach(path => {
                path.removeAttribute('fill');
            });
        })
        .catch(error => {
            console.error('Error loading map:', error);
            mapContainer.innerHTML = '<p>Error loading map. Please try again later.</p>';
        });
});

// Add scroll animations
const observerOptions = {
    threshold: 0.1
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, observerOptions);

document.querySelectorAll('.fade-in').forEach(element => {
    observer.observe(element);
});

// Form handling
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('contact-form');
    if (form) {
        form.addEventListener('submit', function(e) {
            // Don't prevent default - let the form submit normally
            // Just show the success message after a brief delay
            setTimeout(() => {
                form.style.display = 'none';
                document.getElementById('success-message').style.display = 'block';
                document.getElementById('success-message').scrollIntoView({ behavior: 'smooth' });
            }, 1000);
        });
    }
}); 