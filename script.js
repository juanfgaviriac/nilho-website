// Modern interactive map implementation
document.addEventListener('DOMContentLoaded', function() {
    const mapContainer = document.getElementById('map');
    let tooltip = null; // Variable to hold the tooltip element

    // Function to create/update tooltip with improved styling
    const createTooltip = () => {
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.className = 'map-tooltip';
            tooltip.style.position = 'absolute';
            tooltip.style.zIndex = '1010';
            tooltip.style.transition = 'opacity 0.2s ease-in-out, transform 0.2s ease-in-out';
            tooltip.style.opacity = '0';
            tooltip.style.transform = 'translateY(10px)';
            tooltip.style.pointerEvents = 'none';
            document.body.appendChild(tooltip);
        }
    };

    // Function to show tooltip with enhanced animation
    const showTooltip = (event, text) => {
        createTooltip();
        tooltip.textContent = text;
        tooltip.style.left = `${event.pageX + 15}px`;
        tooltip.style.top = `${event.pageY + 15}px`;
        // Use setTimeout to trigger the animation
        setTimeout(() => {
            tooltip.style.opacity = '1';
            tooltip.style.transform = 'translateY(0)';
        }, 10);
    };

    // Function to hide tooltip
    const hideTooltip = () => {
        if (tooltip) {
            tooltip.style.opacity = '0';
            tooltip.style.transform = 'translateY(10px)';
        }
    };
    
    // Use the provided SVG map
    fetch('world (1).svg')
        .then(response => {
            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.status}`);
            }
            return response.text();
        })
        .then(svgContent => {
            mapContainer.innerHTML = svgContent;
            
            const svg = mapContainer.querySelector('svg');
            svg.setAttribute('width', '100%');
            svg.setAttribute('height', '100%');
            
            // Define our service countries with their paths AND names
            const serviceCountries = {
                'ES': { name: 'Spain', url: 'https://cuponhub.es' },      
                'PT': { name: 'Portugal', url: 'https://cupaohub.pt' },      
                'MX': { name: 'Mexico', url: 'https://cuponhub.com.mx' },  
                'CO': { name: 'Colombia', url: 'https://cuponhub.com.co' },  
                'AR-2': { name: 'Argentina', url: 'https://cuponhub.com.ar' }, 
                'CL': { name: 'Chile', url: 'https://www.cuponhub.cl' },
                'AE': { name: 'United Arab Emirates', url: 'https://couponhub.ae' }       
            };

            // Add click and hover handlers for service countries
            const setupCountryInteractions = (element, countryData) => {
                if (element) {
                    // Click handler with ripple effect animation
                    element.addEventListener('click', (event) => {
                        // Create ripple effect
                        const ripple = document.createElement('div');
                        ripple.style.position = 'absolute';
                        ripple.style.width = '20px';
                        ripple.style.height = '20px';
                        ripple.style.background = 'rgba(255, 255, 255, 0.6)';
                        ripple.style.borderRadius = '50%';
                        ripple.style.transform = 'scale(0)';
                        ripple.style.transformOrigin = 'center';
                        ripple.style.transition = 'transform 0.6s ease-out, opacity 0.6s ease-out';
                        ripple.style.zIndex = '1000';
                        ripple.style.left = `${event.pageX}px`;
                        ripple.style.top = `${event.pageY}px`;
                        ripple.style.marginLeft = '-10px';
                        ripple.style.marginTop = '-10px';
                        document.body.appendChild(ripple);
                        
                        requestAnimationFrame(() => {
                            ripple.style.transform = 'scale(30)';
                            ripple.style.opacity = '0';
                        });
                        
                        setTimeout(() => {
                            ripple.remove();
                            window.open(countryData.url, '_blank');
                        }, 400);
                    });
                    
                    // Mouseover handler (show tooltip)
                    element.addEventListener('mouseover', (event) => {
                        showTooltip(event, countryData.name);
                    });

                    // Mousemove handler (update tooltip position)
                    element.addEventListener('mousemove', (event) => {
                        if (tooltip && tooltip.style.opacity === '1') {
                             tooltip.style.left = `${event.pageX + 15}px`; 
                             tooltip.style.top = `${event.pageY + 15}px`;
                        }
                    });

                    // Mouseout handler (hide tooltip)
                    element.addEventListener('mouseout', () => {
                        hideTooltip();
                    });
                }
            };

            // Add interactions for each country using ID selectors
            Object.entries(serviceCountries).forEach(([countryCode, data]) => {
                let countryPath;
                
                // Special handling for Chile which has multiple paths
                if (countryCode === 'CL') {
                    countryPath = svg.querySelector(`path[id="CL"]`);
                    if (countryPath) {
                        setupCountryInteractions(countryPath, data);
                    }
                    // Also handle the second Chile path
                    const chilePath2 = svg.querySelector(`path[id="CL-1"]`);
                    if (chilePath2) {
                        setupCountryInteractions(chilePath2, data);
                    }
                } else {
                    countryPath = svg.querySelector(`path[id="${countryCode}"]`);
                    setupCountryInteractions(countryPath, data);
                }
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

    // Enhanced scroll animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px' // Trigger slightly before elements come into view
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                
                // Get any child elements with data-delay attributes and animate them sequentially
                const delayedElements = entry.target.querySelectorAll('[data-delay]');
                delayedElements.forEach(el => {
                    const delay = parseInt(el.getAttribute('data-delay'));
                    setTimeout(() => {
                        el.classList.add('visible');
                    }, delay);
                });
            }
        });
    }, observerOptions);

    document.querySelectorAll('.fade-in').forEach(element => {
        observer.observe(element);
    });
}); 
